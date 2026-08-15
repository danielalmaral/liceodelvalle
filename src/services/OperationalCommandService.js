function createOperationalCommandService(dependencies) {
  var utils = dependencies.utils;
  var services = dependencies.services || {};
  var repositories = dependencies.repositories || {};
  var idGenerator = dependencies.idGenerator || {};
  var counter = 0;

  function nextOperationId(prefix, provided) {
    if (provided) {
      return provided;
    }

    if (idGenerator.operationId) {
      return idGenerator.operationId(prefix);
    }

    counter += 1;
    return prefix + '-' + counter;
  }

  function appendAudit(event) {
    return services.auditService.appendEvent(event);
  }

  function afterWrite(writeFn, eventFn) {
    var result = writeFn();
    try {
      appendAudit(eventFn(result));
    } catch (error) {
      throw utils.createDomainError('AUDIT_PERSISTENCE_FAILED_AFTER_WRITE', '');
    }
    return result;
  }

  function getAttendance(id) {
    return repositories.attendanceRepository.getAll().filter(function(record) {
      return record.ASISTENCIA_ID === id;
    })[0] || null;
  }

  function resolveAbsence(attendanceId, targetState, options) {
    options = options || {};
    var before = getAttendance(attendanceId);
    var opId = nextOperationId('ABSENCE', options.operationId);
    return afterWrite(function() {
      return services.absenceResolutionService.resolveAbsence(attendanceId, targetState, options);
    }, function(result) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-ASISTENCIAS-TRANSICION_AUSENCIA',
        USUARIO: options.actor || 'SYSTEM',
        ENTIDAD: 'ASISTENCIAS',
        ENTIDAD_ID: attendanceId,
        ACCION: 'TRANSICION_AUSENCIA',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: before ? before.ESTADO : '',
        VALOR_NUEVO: result.attendance.ESTADO,
        MOTIVO: options.reason || 'STATUS_CHANGE'
      };
    });
  }

  function resolveExpiredAbsences(now, options) {
    options = options || {};
    var opId = nextOperationId('EXPIRE_ABSENCES', options.operationId);
    var beforeById = {};
    repositories.attendanceRepository.getAll().forEach(function(record) {
      beforeById[record.ASISTENCIA_ID] = record.ESTADO;
    });
    var results = services.absenceResolutionService.resolveExpiredAbsences(now);
    try {
      results.forEach(function(result, index) {
        appendAudit({
          EVENTO_ID: 'AUD-' + opId + '-' + index + '-ASISTENCIAS-TRANSICION_AUSENCIA',
          USUARIO: options.actor || 'SYSTEM',
          ENTIDAD: 'ASISTENCIAS',
          ENTIDAD_ID: result.attendance.ASISTENCIA_ID,
          ACCION: 'TRANSICION_AUSENCIA',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: beforeById[result.attendance.ASISTENCIA_ID] || 'F',
          VALOR_NUEVO: result.attendance.ESTADO,
          MOTIVO: 'EXPIRATION'
        });
      });
    } catch (error) {
      throw utils.createDomainError('AUDIT_PERSISTENCE_FAILED_AFTER_WRITE', '');
    }
    return results;
  }

  function getDetail(convocationId, studentId) {
    return repositories.detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId && detail.ALUMNO_ID === studentId;
    })[0] || null;
  }

  function setFinalSelection(convocationId, studentId, selected, reason, options) {
    options = options || {};
    var before = getDetail(convocationId, studentId);
    var opId = nextOperationId('CONVOCATION_SELECTION', options.operationId);
    return afterWrite(function() {
      return services.convocationService.setFinalSelection(convocationId, studentId, selected, reason);
    }, function(result) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-CAMBIO_MANUAL',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'CONVOCATORIA_DETALLE',
        ENTIDAD_ID: result.DETALLE_ID,
        ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
        CAMPO: 'SELECCIONADO_FINAL',
        VALOR_ANTERIOR: before ? before.SELECCIONADO_FINAL : '',
        VALOR_NUEVO: result.SELECCIONADO_FINAL,
        MOTIVO: reason || 'MANUAL_CHANGE'
      };
    });
  }

  function assignPlayerPosition(convocationId, studentId, position, reason, options) {
    options = options || {};
    var before = getDetail(convocationId, studentId);
    var opId = nextOperationId('CONVOCATION_POSITION', options.operationId);
    return afterWrite(function() {
      return services.convocationService.assignPlayerPosition(convocationId, studentId, position, reason);
    }, function(result) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-CAMBIO_MANUAL',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'CONVOCATORIA_DETALLE',
        ENTIDAD_ID: result.DETALLE_ID,
        ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
        CAMPO: 'POSICION_ASIGNADA',
        VALOR_ANTERIOR: before ? before.POSICION_ASIGNADA : '',
        VALOR_NUEVO: result.POSICION_ASIGNADA,
        MOTIVO: reason || 'MANUAL_CHANGE'
      };
    });
  }

  function approveConvocation(convocationId, actor, options) {
    options = options || {};
    var opId = nextOperationId('CONVOCATION_APPROVAL', options.operationId);
    return afterWrite(function() {
      return services.convocationService.approveConvocation(convocationId, actor);
    }, function(result) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIAS-APROBACION',
        USUARIO: actor,
        ENTIDAD: 'CONVOCATORIAS',
        ENTIDAD_ID: convocationId,
        ACCION: 'APROBACION',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: 'PROPUESTA',
        VALOR_NUEVO: result.ESTADO,
        MOTIVO: 'HUMAN_APPROVAL'
      };
    });
  }

  function updateParticipation(participationId, updates, options) {
    options = options || {};
    var before = repositories.participationRepository.getAll().filter(function(record) {
      return record.PARTICIPACION_ID === participationId;
    })[0] || {};
    var field = Object.keys(updates)[0] || 'PARTICIPACION';
    var opId = nextOperationId('PARTICIPATION_UPDATE', options.operationId);
    return afterWrite(function() {
      return services.participationService.updateParticipation(participationId, updates);
    }, function(result) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION_PARTIDO-ACTUALIZACION',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'PARTICIPACION_PARTIDO',
        ENTIDAD_ID: participationId,
        ACCION: 'ACTUALIZACION',
        CAMPO: field,
        VALOR_ANTERIOR: before[field],
        VALOR_NUEVO: result[field],
        MOTIVO: 'POST_MATCH_CAPTURE'
      };
    });
  }

  function createParticipation(input, options) {
    options = options || {};
    var opId = nextOperationId('PARTICIPATION_CREATE', options.operationId);
    return afterWrite(function() {
      return services.participationService.createParticipation(input);
    }, function(result) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION_PARTIDO-CREACION',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'PARTICIPACION_PARTIDO',
        ENTIDAD_ID: result.PARTICIPACION_ID,
        ACCION: 'CREACION',
        CAMPO: 'PARTICIPACION_ID',
        VALOR_ANTERIOR: '',
        VALOR_NUEVO: result.PARTICIPACION_ID,
        MOTIVO: 'POST_MATCH_CAPTURE'
      };
    });
  }

  function sendPendingCommunications(options) {
    options = options || {};
    var opId = nextOperationId('COMMUNICATION_SEND', options.operationId);
    var results = services.communicationService.sendPendingCommunications();
    try {
      results.forEach(function(result, index) {
        appendAudit({
          EVENTO_ID: 'AUD-' + opId + '-' + index + '-COMUNICACIONES-CAMBIO_ESTADO',
          USUARIO: 'SYSTEM',
          ENTIDAD: 'COMUNICACIONES',
          ENTIDAD_ID: result.communication.COMUNICACION_ID,
          ACCION: 'CAMBIO_ESTADO',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: 'PENDIENTE',
          VALOR_NUEVO: result.communication.ESTADO,
          MOTIVO: 'SEND_ATTEMPT'
        });
      });
    } catch (error) {
      throw utils.createDomainError('AUDIT_PERSISTENCE_FAILED_AFTER_WRITE', '');
    }
    return results;
  }

  function retryCommunication(communicationId, options) {
    options = options || {};
    var opId = nextOperationId('COMMUNICATION_RETRY', options.operationId);
    return afterWrite(function() {
      return services.communicationService.retryCommunication(communicationId);
    }, function(result) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-COMUNICACIONES-CAMBIO_ESTADO',
        USUARIO: 'SYSTEM',
        ENTIDAD: 'COMUNICACIONES',
        ENTIDAD_ID: communicationId,
        ACCION: 'CAMBIO_ESTADO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: 'ERROR',
        VALOR_NUEVO: result.communication.ESTADO,
        MOTIVO: 'SEND_ATTEMPT'
      };
    });
  }

  return {
    approveConvocation: approveConvocation,
    assignPlayerPosition: assignPlayerPosition,
    createParticipation: createParticipation,
    resolveAbsence: resolveAbsence,
    resolveExpiredAbsences: resolveExpiredAbsences,
    retryCommunication: retryCommunication,
    sendPendingCommunications: sendPendingCommunications,
    setFinalSelection: setFinalSelection,
    updateParticipation: updateParticipation
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createOperationalCommandService };
}
