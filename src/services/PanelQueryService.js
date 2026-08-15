function createPanelQueryService(dependencies) {
  var queries = dependencies.queries;
  var configService = dependencies.configService;

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

  function getDashboard() {
    var sessions = queries.getSessions();
    var attendances = queries.getAttendances();
    var matches = queries.getMatches();
    var communications = queries.getCommunications();
    var participations = queries.getParticipations();
    var openSessions = sessions.filter(function(session) { return session.estado === 'ABIERTA'; });
    var pendingAbsences = attendances.filter(function(attendance) { return attendance.estado === 'F'; });
    var communicationPending = communications.filter(function(record) { return record.ESTADO === 'PENDIENTE'; }).length;
    var communicationError = communications.filter(function(record) { return record.ESTADO === 'ERROR'; }).length;
    var communicationUncertain = communications.filter(function(record) { return record.ERROR === 'DELIVERY_ATTEMPT_IN_PROGRESS'; }).length;
    var convocationByMatch = {};
    var alerts = [];

    convocations().forEach(function(convocation) {
      convocationByMatch[convocation.PARTIDO_ID] = {
        convocationId: convocation.CONVOCATORIA_ID,
        estado: convocation.ESTADO,
        totalSeleccionados: convocation.TOTAL_SELECCIONADOS,
        objetivo: convocation.TOTAL_OBJETIVO,
        totalAlertas: convocation.TOTAL_ALERTAS
      };
    });

    matches.forEach(function(match) {
      var readiness = { alerts: [] };
      try {
        readiness = queries.validateMatchParticipationReadiness(match.partidoId);
      } catch (error) {
        readiness = { alerts: [] };
      }
      alerts = alerts.concat(readiness.alerts || []);
    });

    return {
      openSessions: openSessions,
      nextSession: sessions.slice().sort(function(a, b) { return a.fecha.getTime() - b.fecha.getTime(); })[0] || null,
      attendanceCaptured: attendances.length,
      attendanceMissing: Math.max(0, queries.getStudents().length * openSessions.length - attendances.length),
      pendingAbsences: pendingAbsences.length,
      nearOrExpiredAbsences: pendingAbsences.length,
      upcomingMatches: matches.filter(function(match) { return match.estado === 'PROGRAMADO'; }),
      convocationStatusByMatch: convocationByMatch,
      communications: {
        pending: communicationPending,
        error: communicationError,
        uncertainDelivery: communicationUncertain
      },
      sportAlerts: alerts.concat(participations.filter(function(record) {
        return Number(record.ROJAS) > 0;
      }).map(function(record) {
        return { code: 'RED_CARD_REVIEW_REQUIRED', studentId: record.ALUMNO_ID, matchId: record.PARTIDO_ID };
      })),
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
    return {
      matchId: matchId,
      readiness: queries.validateMatchParticipationReadiness(matchId),
      rows: queries.getParticipations().filter(function(record) {
        return record.PARTIDO_ID === matchId;
      }).map(function(record) {
        return {
          ALUMNO_ID: record.ALUMNO_ID,
          ASISTIO: record.ASISTIO,
          ASISTENCIA_ESTADO: record.ASISTENCIA_ESTADO,
          CONDICION_INICIAL: record.CONDICION_INICIAL,
          MINUTOS_JUGADOS: record.MINUTOS_JUGADOS,
          GOLES: record.GOLES,
          AMARILLAS: record.AMARILLAS,
          ROJAS: record.ROJAS,
          CALIFICACION: record.CALIFICACION
        };
      })
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
