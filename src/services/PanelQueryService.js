function createPanelQueryService(dependencies) {
  var queries = dependencies.queries;
  var configService = dependencies.configService;
  var utils = dependencies.utils;
  var clock = dependencies.clock || { now: function() { return new Date(); } };
  var AUTHORITATIVE_CONVOCATION_STATES = ['APROBADA', 'ENVIADA', 'CERRADA'];

  function studentNameById() {
    var names = {};
    queries.getStudents().forEach(function(student) {
      names[student.alumnoId] = [student.nombre, student.apellidos].join(' ').trim();
    });
    return names;
  }

  function detailsFor(convocationId) {
    return (dependencies.detailRepository ? dependencies.detailRepository.getAll() : []).filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId;
    });
  }

  function convocations() {
    return dependencies.convocationRepository ? dependencies.convocationRepository.getAll() : [];
  }

  function normalizeBoolean(value, fieldName) {
    if (!utils || typeof utils.normalizeStrictBoolean !== 'function') {
      throw new Error('PANEL_UTILS_REQUIRED');
    }
    return utils.normalizeStrictBoolean(value, fieldName || 'BOOLEAN');
  }

  function sessionStart(session) {
    return new Date(session.fecha.toISOString().slice(0, 10) + 'T' + (session.horaInicio || '00:00'));
  }

  function sessionEnd(session) {
    return new Date(session.fecha.toISOString().slice(0, 10) + 'T' + (session.horaFin || session.horaInicio || '23:59'));
  }

  function compareSessions(left, right) {
    var startDiff = sessionStart(left).getTime() - sessionStart(right).getTime();
    if (startDiff !== 0) {
      return startDiff;
    }
    return String(left.sesionId).localeCompare(String(right.sesionId));
  }

  function currentAndNextSession(sessions, now) {
    var open = sessions.filter(function(session) { return session.estado === 'ABIERTA'; });
    var current = open.filter(function(session) {
      return sessionStart(session).getTime() <= now.getTime() && sessionEnd(session).getTime() >= now.getTime();
    }).sort(compareSessions)[0] || null;
    var next = open.filter(function(session) {
      return sessionStart(session).getTime() > now.getTime();
    }).sort(compareSessions)[0] || null;

    return { current: current, next: next };
  }

  function expectedStudentsFor(session, students) {
    return students.filter(function(student) {
      if (!student.active) {
        return false;
      }
      if (session.competencia === 'A' || session.competencia === 'B') {
        return student.competenciaBase === session.competencia;
      }
      return true;
    });
  }

  function compareStudents(left, right) {
    var groupDiff = String(left.grupo || '').localeCompare(String(right.grupo || ''));
    if (groupDiff !== 0) {
      return groupDiff;
    }
    var lastDiff = String(left.apellidos || '').localeCompare(String(right.apellidos || ''));
    if (lastDiff !== 0) {
      return lastDiff;
    }
    var firstDiff = String(left.nombre || '').localeCompare(String(right.nombre || ''));
    if (firstDiff !== 0) {
      return firstDiff;
    }
    return String(left.alumnoId || '').localeCompare(String(right.alumnoId || ''));
  }

  function compareMatches(left, right) {
    var dateDiff = left.fecha.getTime() - right.fecha.getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    var timeDiff = String(left.horaPartido || '').localeCompare(String(right.horaPartido || ''));
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return String(left.partidoId || '').localeCompare(String(right.partidoId || ''));
  }

  function attendanceCounts(sessions, attendances, students) {
    return sessions.filter(function(session) { return session.estado === 'ABIERTA'; }).sort(compareSessions).map(function(session) {
      var expected = expectedStudentsFor(session, students).length;
      var captured = attendances.filter(function(attendance) {
        return attendance.sesionId === session.sesionId;
      }).length;
      return {
        captured: captured,
        expected: expected,
        missing: Math.max(0, expected - captured),
        sessionId: session.sesionId
      };
    });
  }

  function authoritativeConvocations() {
    var byMatch = {};
    var proposals = [];

    convocations().forEach(function(convocation) {
      if (AUTHORITATIVE_CONVOCATION_STATES.indexOf(convocation.ESTADO) !== -1) {
        if (byMatch[convocation.PARTIDO_ID]) {
          throw new Error('PANEL_MULTIPLE_AUTHORITATIVE_CONVOCATIONS: ' + convocation.PARTIDO_ID);
        }
        byMatch[convocation.PARTIDO_ID] = convocation;
      } else if (convocation.ESTADO === 'BORRADOR' || convocation.ESTADO === 'PROPUESTA') {
        proposals.push(convocation);
      }
    });

    return { authoritativeByMatch: byMatch, proposals: proposals };
  }

  function getDashboard() {
    var sessions = queries.getSessions();
    var attendances = queries.getAttendances();
    var matches = queries.getMatches();
    var communications = queries.getCommunications();
    var pendingAbsences = attendances.filter(function(attendance) { return attendance.estado === 'F'; });
    var now = clock.now();
    var sessionFocus = currentAndNextSession(sessions, now);
    var attendanceBySession = attendanceCounts(sessions, attendances, queries.getStudents());
    var focusSession = sessionFocus.current || sessionFocus.next;
    var focusSummary = focusSession ? attendanceBySession.filter(function(item) { return item.sessionId === focusSession.sesionId; })[0] : null;
    var communicationPending = communications.filter(function(record) { return record.ESTADO === 'PENDIENTE'; }).length;
    var communicationError = communications.filter(function(record) { return record.ESTADO === 'ERROR'; }).length;
    var communicationUncertain = communications.filter(function(record) { return record.ERROR === 'DELIVERY_ATTEMPT_IN_PROGRESS'; }).length;
    var convocationSummary = authoritativeConvocations();
    var alerts = [];
    var readinessIssues = [];

    matches.filter(function(match) { return match.estado === 'JUGADO'; }).forEach(function(match) {
      var readiness = { alerts: [] };
      try {
        readiness = queries.validateMatchParticipationReadiness(match.partidoId);
      } catch (error) {
        readinessIssues.push({ code: String(error && error.message ? error.message : 'READINESS_ERROR').split(':')[0], matchId: match.partidoId });
        return;
      }
      alerts = alerts.concat(readiness.alerts || []);
      (readiness.errors || []).forEach(function(code) {
        readinessIssues.push({ code: code, matchId: match.partidoId });
      });
    });

    return {
      attendanceBySession: attendanceBySession,
      attendanceSummary: focusSummary || { captured: 0, expected: 0, missing: 0, sessionId: '' },
      currentSession: sessionFocus.current,
      nextSession: sessionFocus.next,
      pendingAbsences: pendingAbsences.length,
      expiredAbsences: pendingAbsences.filter(function(absence) {
        return absence.limiteJustificacion && absence.limiteJustificacion.getTime() < now.getTime();
      }).length,
      nextAbsenceDeadline: pendingAbsences.filter(function(absence) {
        return absence.limiteJustificacion && absence.limiteJustificacion.getTime() >= now.getTime();
      }).sort(function(left, right) {
        return left.limiteJustificacion.getTime() - right.limiteJustificacion.getTime();
      }).map(function(absence) { return absence.limiteJustificacion; })[0] || '',
      upcomingMatches: matches.filter(function(match) { return match.estado === 'PROGRAMADO'; }).sort(compareMatches),
      nextMatchA: matches.filter(function(match) { return match.estado === 'PROGRAMADO' && match.competencia === 'A'; }).sort(compareMatches)[0] || null,
      nextMatchB: matches.filter(function(match) { return match.estado === 'PROGRAMADO' && match.competencia === 'B'; }).sort(compareMatches)[0] || null,
      convocationStatusByMatch: convocationSummary.authoritativeByMatch,
      convocationProposals: convocationSummary.proposals,
      communications: {
        pending: communicationPending,
        error: communicationError,
        uncertainDelivery: communicationUncertain
      },
      readinessIssues: readinessIssues,
      sportAlerts: alerts,
      configMailEnabled: configService ? {
        absence: configService.getBoolean('AVISO_AUSENCIA_EMAIL'),
        convocation: configService.getBoolean('CONVOCATORIA_EMAIL')
      } : {}
    };
  }

  function getAttendanceView(sessionId) {
    var names = studentNameById();
    var students = queries.getStudents();
    var attendances = queries.getAttendances().filter(function(attendance) {
      return attendance.sesionId === sessionId;
    });
    var attendanceByStudent = {};
    var session = queries.getSessions().filter(function(candidate) {
      return candidate.sesionId === sessionId;
    })[0] || null;

    attendances.forEach(function(attendance) {
      attendanceByStudent[attendance.alumnoId] = attendance;
    });

    return {
      sessionId: sessionId,
      session: session,
      rows: expectedStudentsFor(session || { competencia: 'GENERAL' }, students).sort(compareStudents).map(function(student) {
        var attendance = attendanceByStudent[student.alumnoId] || {};
        return {
          attendanceId: attendance.asistenciaId || '',
          studentId: student.alumnoId,
          nombre: names[student.alumnoId],
          apellidos: student.apellidos,
          grupo: student.grupo,
          competencia: student.competenciaBase,
          estadoActual: attendance.estado || '',
          registradoEn: attendance.registradoEn || '',
          pendienteJustificar: attendance.estado === 'F',
          limiteJustificacion: attendance.limiteJustificacion || '',
          capabilities: {
            canMarkAttendance: session && session.estado === 'ABIERTA' && !attendance.asistenciaId,
            canResolveAbsence: attendance.estado === 'F' && !!attendance.asistenciaId
          }
        };
      })
    };
  }

  function getConvocationView(convocationId) {
    var names = studentNameById();
    return {
      convocationId: convocationId,
      details: detailsFor(convocationId).map(function(detail) {
        return {
          ALUMNO_ID: detail.ALUMNO_ID,
          nombre: names[detail.ALUMNO_ID] || detail.ALUMNO_ID,
          ELEGIBILITY_STATUS: detail.ELEGIBILITY_STATUS,
          MOTIVO_NO_ELEGIBLE: detail.MOTIVO_NO_ELEGIBLE,
          nivel: detail.NIVEL_SNAPSHOT,
          posicionPrincipal: detail.POSICION_PRINCIPAL_SNAPSHOT,
          posicionSecundaria: detail.POSICION_SECUNDARIA_SNAPSHOT,
          posicionAsignada: detail.POSICION_ASIGNADA,
          puntajeAsistencia: detail.PUNTAJE_ASISTENCIA_SNAPSHOT,
          presenciaReal: detail.PRESENCIA_REAL_SNAPSHOT,
          rotacionAntes: detail.ROTACION_ANTES,
          prioridadRotacion: detail.PRIORIDAD_ROTACION,
          recomendadoSistema: detail.RECOMENDADO_SISTEMA,
          seleccionadoFinal: normalizeBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL'),
          cambioManual: detail.CAMBIO_MANUAL,
          motivoCambio: detail.MOTIVO_CAMBIO,
          rotationException: detail.ROTATION_EXCEPTION,
          ordenPrioridad: detail.ORDEN_PRIORIDAD
        };
      })
    };
  }

  function getParticipationView(matchId) {
    var names = studentNameById();
    var convocationSummary = authoritativeConvocations();
    var authoritative = convocationSummary.authoritativeByMatch[matchId] || null;
    var participationByStudent = {};
    var matchSession = queries.getSessions().filter(function(session) {
      return session.tipo === 'PARTIDO' && session.partidoId === matchId;
    })[0] || null;
    var attendanceByStudent = {};
    var issues = [];

    queries.getParticipations().filter(function(record) {
      return record.PARTIDO_ID === matchId;
    }).forEach(function(record) {
      participationByStudent[record.ALUMNO_ID] = record;
    });

    if (!matchSession) {
      issues.push({ code: 'PANEL_POSTMATCH_MATCH_SESSION_REQUIRED', matchId: matchId });
    } else {
      queries.getAttendances().filter(function(attendance) {
        return attendance.sesionId === matchSession.sesionId;
      }).forEach(function(attendance) {
        attendanceByStudent[attendance.alumnoId] = attendance;
      });
    }

    return {
      matchId: matchId,
      readiness: queries.validateMatchParticipationReadiness(matchId),
      issues: issues,
      rows: authoritative ? detailsFor(authoritative.CONVOCATORIA_ID).filter(function(detail) {
        return normalizeBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL');
      }).map(function(detail) {
        var record = participationByStudent[detail.ALUMNO_ID] || {};
        var attendance = attendanceByStudent[detail.ALUMNO_ID] || null;
        var attendanceState = attendance ? attendance.estado : '';
        var attended = attendanceState === 'A' || attendanceState === 'R';
        if (!attendance) {
          issues.push({ code: 'PANEL_POSTMATCH_ATTENDANCE_REQUIRED', matchId: matchId, studentId: detail.ALUMNO_ID });
        }
        return {
          ALUMNO_ID: detail.ALUMNO_ID,
          nombre: names[detail.ALUMNO_ID] || detail.ALUMNO_ID,
          CONVOCATORIA_ID: authoritative.CONVOCATORIA_ID,
          PARTICIPACION_ID: record.PARTICIPACION_ID || '',
          attendanceId: attendance ? attendance.asistenciaId : '',
          ASISTIO: record.ASISTIO === undefined ? '' : record.ASISTIO,
          ASISTENCIA_ESTADO: attendanceState,
          ASISTIO_DERIVADO: attendance ? attended : '',
          CONDICION_INICIAL: record.CONDICION_INICIAL || '',
          MINUTOS_JUGADOS: record.MINUTOS_JUGADOS === undefined ? '' : record.MINUTOS_JUGADOS,
          GOLES: record.GOLES === undefined ? '' : record.GOLES,
          AMARILLAS: record.AMARILLAS === undefined ? '' : record.AMARILLAS,
          ROJAS: record.ROJAS === undefined ? '' : record.ROJAS,
          CALIFICACION: record.CALIFICACION === undefined ? '' : record.CALIFICACION
        };
      }) : []
    };
  }

  function getReferenceData() {
    var convocationSummary = authoritativeConvocations();
    var matches = queries.getMatches();
    return {
      openSessions: queries.getSessions().filter(function(session) { return session.estado === 'ABIERTA'; }).sort(compareSessions),
      programmedMatches: matches.filter(function(match) { return match.estado === 'PROGRAMADO'; }).sort(compareMatches),
      playedMatches: matches.filter(function(match) { return match.estado === 'JUGADO'; }).sort(compareMatches),
      convocationProposals: convocationSummary.proposals,
      authoritativeConvocations: Object.keys(convocationSummary.authoritativeByMatch).map(function(matchId) {
        return convocationSummary.authoritativeByMatch[matchId];
      }),
      runtimeCapabilities: typeof queries.getRuntimeCapabilities === 'function' ? queries.getRuntimeCapabilities() : { externalMailEnabled: false }
    };
  }

  return {
    getAttendanceView: getAttendanceView,
    getConvocationView: getConvocationView,
    getDashboard: getDashboard,
    getParticipationView: getParticipationView,
    getReferenceData: getReferenceData
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createPanelQueryService };
}
