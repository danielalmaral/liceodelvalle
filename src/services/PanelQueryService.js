function createPanelQueryService(dependencies) {
  var queries = dependencies.queries;
  var configService = dependencies.configService;
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

  function normalizeBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    return typeof value === 'string' && value.trim().toUpperCase() === 'TRUE';
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
        if (!byMatch[convocation.PARTIDO_ID] || String(convocation.CONVOCATORIA_ID).localeCompare(String(byMatch[convocation.PARTIDO_ID].CONVOCATORIA_ID)) < 0) {
          byMatch[convocation.PARTIDO_ID] = convocation;
        }
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

    matches.forEach(function(match) {
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
      upcomingMatches: matches.filter(function(match) { return match.estado === 'PROGRAMADO'; }),
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
      rows: students.map(function(student) {
        var attendance = attendanceByStudent[student.alumnoId] || {};
        return {
          studentId: student.alumnoId,
          nombre: names[student.alumnoId],
          grupo: student.grupo,
          competencia: student.competenciaBase,
          estadoActual: attendance.estado || '',
          registradoEn: attendance.registradoEn || '',
          pendienteJustificar: attendance.estado === 'F',
          limiteJustificacion: attendance.limiteJustificacion || '',
          capabilities: {
            canMarkAttendance: session && session.estado === 'ABIERTA' && !attendance.asistenciaId,
            canResolveAbsence: attendance.estado === 'F'
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
          seleccionadoFinal: detail.SELECCIONADO_FINAL,
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

    queries.getParticipations().filter(function(record) {
      return record.PARTIDO_ID === matchId;
    }).forEach(function(record) {
      participationByStudent[record.ALUMNO_ID] = record;
    });

    return {
      matchId: matchId,
      readiness: queries.validateMatchParticipationReadiness(matchId),
      rows: authoritative ? detailsFor(authoritative.CONVOCATORIA_ID).filter(function(detail) {
        return normalizeBoolean(detail.SELECCIONADO_FINAL);
      }).map(function(detail) {
        var record = participationByStudent[detail.ALUMNO_ID] || {};
        return {
          ALUMNO_ID: detail.ALUMNO_ID,
          nombre: names[detail.ALUMNO_ID] || detail.ALUMNO_ID,
          PARTICIPACION_ID: record.PARTICIPACION_ID || '',
          ASISTIO: record.ASISTIO === undefined ? '' : record.ASISTIO,
          ASISTENCIA_ESTADO: record.ASISTENCIA_ESTADO || '',
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

  return {
    getAttendanceView: getAttendanceView,
    getConvocationView: getConvocationView,
    getDashboard: getDashboard,
    getParticipationView: getParticipationView
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createPanelQueryService };
}
