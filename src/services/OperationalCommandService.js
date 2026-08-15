function createOperationalCommandService(dependencies) {
  var utils = dependencies.utils;
  var services = dependencies.services || {};
  var repositories = dependencies.repositories || {};
  var idGenerator = dependencies.idGenerator || {};
  var auditedFields = ['MINUTOS_JUGADOS', 'GOLES', 'AMARILLAS', 'ROJAS', 'CALIFICACION'];

  if (typeof idGenerator.operationId !== 'function') {
    throw utils.createDomainError('RUNTIME_OPERATION_ID_GENERATOR_REQUIRED', 'operationId');
  }

  function requireOperationId(prefix, options) {
    var id = options && options.operationId ? options.operationId : idGenerator.operationId(prefix);

    if (!id || String(id).trim() === '') {
      throw utils.createDomainError('RUNTIME_OPERATION_ID_GENERATOR_REQUIRED', prefix);
    }

    return String(id).trim();
  }

  function copyRecord(record) {
    var next = {};
    Object.keys(record || {}).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function canonicalValue(value) {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  }

  function canonicalEvent(event) {
    return {
      ENTIDAD: canonicalValue(event.ENTIDAD),
      ENTIDAD_ID: canonicalValue(event.ENTIDAD_ID),
      ACCION: canonicalValue(event.ACCION),
      CAMPO: canonicalValue(event.CAMPO),
      VALOR_ANTERIOR: canonicalValue(event.VALOR_ANTERIOR),
      VALOR_NUEVO: canonicalValue(event.VALOR_NUEVO),
      MOTIVO: canonicalValue(event.MOTIVO)
    };
  }

  function sameEvent(left, right) {
    var a = canonicalEvent(left);
    var b = canonicalEvent(right);
    return Object.keys(a).every(function(key) {
      return a[key] === b[key];
    });
  }

  function existingEventsFor(operationId) {
    var prefix = 'AUD-' + operationId + '-';
    return services.auditService.getEvents().filter(function(event) {
      return event.EVENTO_ID.indexOf(prefix) === 0;
    });
  }

  function beginAuditedOperation(operationId, expectedEvents) {
    var existing = existingEventsFor(operationId);
    var expectedById = {};
    var existingById = {};

    expectedEvents.forEach(function(event) {
      expectedById[event.EVENTO_ID] = event;
    });

    existing.forEach(function(event) {
      existingById[event.EVENTO_ID] = event;
    });

    if (existing.length === 0) {
      return { status: 'NEW_OPERATION', events: [] };
    }

    if (expectedEvents.length === 0) {
      return { status: 'IDEMPOTENT_REPLAY', events: existing };
    }

    if (existing.length !== expectedEvents.length) {
      throw utils.createDomainError('OPERATION_ID_CONFLICT', operationId);
    }

    expectedEvents.forEach(function(event) {
      if (!existingById[event.EVENTO_ID] || !sameEvent(existingById[event.EVENTO_ID], event)) {
        throw utils.createDomainError('OPERATION_ID_CONFLICT', operationId);
      }
    });

    return { status: 'IDEMPOTENT_REPLAY', events: existing };
  }

  function appendEvents(events) {
    events.forEach(function(event) {
      services.auditService.appendEvent(event);
    });
  }

  function runAudited(operationId, expectedEvents, writeFn, resultEventsFn) {
    var status = beginAuditedOperation(operationId, expectedEvents);
    var result;
    var events;

    if (status.status === 'IDEMPOTENT_REPLAY') {
      return { idempotent: true, operationId: operationId, auditEvents: status.events };
    }

    result = writeFn();
    events = resultEventsFn ? resultEventsFn(result) : expectedEvents;
    try {
      appendEvents(events);
    } catch (error) {
      throw utils.createDomainError('AUDIT_PERSISTENCE_FAILED_AFTER_WRITE', operationId);
    }
    return result;
  }

  function getAttendance(id) {
    return repositories.attendanceRepository.getAll().filter(function(record) {
      return record.ASISTENCIA_ID === id;
    })[0] || null;
  }

  function absenceMotive(targetState, reason) {
    if (reason === 'EXPIRED' || targetState === 'FI') {
      return 'ABSENCE_EXPIRED';
    }
    if (targetState === 'LES') {
      return 'INJURY_RECORDED';
    }
    if (targetState === 'FJ') {
      return 'ABSENCE_JUSTIFIED';
    }
    return 'STATUS_CHANGE';
  }

  function resolveAbsence(attendanceId, targetState, options) {
    options = options || {};
    var before = getAttendance(attendanceId);
    var opId = requireOperationId('ABSENCE', options);
    var event = {
      EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + attendanceId + '-TRANSICION_AUSENCIA',
      USUARIO: options.actor || 'SYSTEM',
      ENTIDAD: 'ASISTENCIAS',
      ENTIDAD_ID: attendanceId,
      ACCION: 'TRANSICION_AUSENCIA',
      CAMPO: 'ESTADO',
      VALOR_ANTERIOR: before ? before.ESTADO : '',
      VALOR_NUEVO: targetState,
      MOTIVO: absenceMotive(targetState, options.reason)
    };

    return runAudited(opId, [event], function() {
      return services.absenceResolutionService.resolveAbsence(attendanceId, targetState, options);
    }, function(result) {
      event.VALOR_NUEVO = result.attendance.ESTADO;
      event.MOTIVO = absenceMotive(result.attendance.ESTADO, options.reason);
      return [event];
    });
  }

  function resolveExpiredAbsences(now, options) {
    options = options || {};
    var opId = requireOperationId('EXPIRE_ABSENCES', options);
    var beforeById = {};
    var expectedEvents = [];

    repositories.attendanceRepository.getAll().forEach(function(record) {
      if (record.ESTADO === 'F' && record.LIMITE_JUSTIFICACION && (now || new Date()).getTime() > new Date(record.LIMITE_JUSTIFICACION).getTime()) {
        beforeById[record.ASISTENCIA_ID] = record.ESTADO;
        expectedEvents.push({
          EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + record.ASISTENCIA_ID + '-TRANSICION_AUSENCIA',
          USUARIO: options.actor || 'SYSTEM',
          ENTIDAD: 'ASISTENCIAS',
          ENTIDAD_ID: record.ASISTENCIA_ID,
          ACCION: 'TRANSICION_AUSENCIA',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: record.ESTADO,
          VALOR_NUEVO: 'FI',
          MOTIVO: 'ABSENCE_EXPIRED'
        });
      }
    });

    return runAudited(opId, expectedEvents, function() {
      return services.absenceResolutionService.resolveExpiredAbsences(now);
    }, function(results) {
      return results.map(function(result) {
        return {
          EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + result.attendance.ASISTENCIA_ID + '-TRANSICION_AUSENCIA',
          USUARIO: options.actor || 'SYSTEM',
          ENTIDAD: 'ASISTENCIAS',
          ENTIDAD_ID: result.attendance.ASISTENCIA_ID,
          ACCION: 'TRANSICION_AUSENCIA',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: beforeById[result.attendance.ASISTENCIA_ID] || 'F',
          VALOR_NUEVO: result.attendance.ESTADO,
          MOTIVO: 'ABSENCE_EXPIRED'
        };
      });
    });
  }

  function getDetail(convocationId, studentId) {
    return repositories.detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId && detail.ALUMNO_ID === studentId;
    })[0] || null;
  }

  function setFinalSelection(convocationId, studentId, selected, reason, options) {
    options = options || {};
    var before = getDetail(convocationId, studentId);
    var detailId = before ? before.DETALLE_ID : convocationId + '-' + studentId;
    var opId = requireOperationId('CONVOCATION_SELECTION', options);
    var event = {
      EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-' + detailId + '-SELECCIONADO_FINAL',
      USUARIO: options.actor || 'coach',
      ENTIDAD: 'CONVOCATORIA_DETALLE',
      ENTIDAD_ID: detailId,
      ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
      CAMPO: 'SELECCIONADO_FINAL',
      VALOR_ANTERIOR: before ? before.SELECCIONADO_FINAL : '',
      VALOR_NUEVO: selected,
      MOTIVO: 'MANUAL_CHANGE'
    };

    return runAudited(opId, [event], function() {
      return services.convocationService.setFinalSelection(convocationId, studentId, selected, reason);
    });
  }

  function assignPlayerPosition(convocationId, studentId, position, reason, options) {
    options = options || {};
    var before = getDetail(convocationId, studentId);
    var detailId = before ? before.DETALLE_ID : convocationId + '-' + studentId;
    var opId = requireOperationId('CONVOCATION_POSITION', options);
    var normalizedPosition = String(position || '').trim().toUpperCase();
    var event = {
      EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-' + detailId + '-POSICION_ASIGNADA',
      USUARIO: options.actor || 'coach',
      ENTIDAD: 'CONVOCATORIA_DETALLE',
      ENTIDAD_ID: detailId,
      ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
      CAMPO: 'POSICION_ASIGNADA',
      VALOR_ANTERIOR: before ? before.POSICION_ASIGNADA : '',
      VALOR_NUEVO: normalizedPosition,
      MOTIVO: 'MANUAL_CHANGE'
    };

    return runAudited(opId, [event], function() {
      return services.convocationService.assignPlayerPosition(convocationId, studentId, position, reason);
    }, function(result) {
      event.VALOR_NUEVO = result.POSICION_ASIGNADA;
      return [event];
    });
  }

  function approveConvocation(convocationId, actor, options) {
    options = options || {};
    var opId = requireOperationId('CONVOCATION_APPROVAL', options);
    var event = {
      EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA-' + convocationId + '-APROBACION',
      USUARIO: actor,
      ENTIDAD: 'CONVOCATORIAS',
      ENTIDAD_ID: convocationId,
      ACCION: 'APROBACION',
      CAMPO: 'ESTADO',
      VALOR_ANTERIOR: 'PROPUESTA',
      VALOR_NUEVO: 'APROBADA',
      MOTIVO: 'HUMAN_APPROVAL'
    };

    return runAudited(opId, [event], function() {
      return services.convocationService.approveConvocation(convocationId, actor);
    });
  }

  function participationEvents(opId, participationId, before, after, actor) {
    return auditedFields.filter(function(field) {
      return canonicalValue(before[field]) !== canonicalValue(after[field]);
    }).map(function(field) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION-' + participationId + '-' + field,
        USUARIO: actor || 'coach',
        ENTIDAD: 'PARTICIPACION_PARTIDO',
        ENTIDAD_ID: participationId,
        ACCION: 'ACTUALIZACION',
        CAMPO: field,
        VALOR_ANTERIOR: before[field],
        VALOR_NUEVO: after[field],
        MOTIVO: 'POST_MATCH_CAPTURE'
      };
    });
  }

  function updateParticipation(participationId, updates, options) {
    options = options || {};
    var before = copyRecord(repositories.participationRepository.getAll().filter(function(record) {
      return record.PARTICIPACION_ID === participationId;
    })[0] || {});
    var expectedAfter = copyRecord(before);
    var opId = requireOperationId('PARTICIPATION_UPDATE', options);

    Object.keys(updates || {}).forEach(function(field) {
      if (field !== 'MODIFICADO_EN') {
        expectedAfter[field] = updates[field];
      }
    });

    return runAudited(opId, participationEvents(opId, participationId, before, expectedAfter, options.actor), function() {
      return services.participationService.updateParticipation(participationId, updates);
    }, function(result) {
      return participationEvents(opId, participationId, before, result, options.actor);
    });
  }

  function createParticipation(input, options) {
    options = options || {};
    var opId = requireOperationId('PARTICIPATION_CREATE', options);
    var normalizedInput = copyRecord(input);
    var participationId = normalizedInput.PARTICIPACION_ID || normalizedInput.participacionId || (idGenerator.participationId ? idGenerator.participationId() : '');

    normalizedInput.PARTICIPACION_ID = participationId;

    return runAudited(opId, [{
      EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION-' + participationId + '-CREACION',
      USUARIO: options.actor || 'coach',
      ENTIDAD: 'PARTICIPACION_PARTIDO',
      ENTIDAD_ID: participationId,
      ACCION: 'CREACION',
      CAMPO: 'PARTICIPACION_ID',
      VALOR_ANTERIOR: '',
      VALOR_NUEVO: participationId,
      MOTIVO: 'POST_MATCH_CAPTURE'
    }], function() {
      return services.participationService.createParticipation(normalizedInput);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION-' + result.PARTICIPACION_ID + '-CREACION',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'PARTICIPACION_PARTIDO',
        ENTIDAD_ID: result.PARTICIPACION_ID,
        ACCION: 'CREACION',
        CAMPO: 'PARTICIPACION_ID',
        VALOR_ANTERIOR: '',
        VALOR_NUEVO: result.PARTICIPACION_ID,
        MOTIVO: 'POST_MATCH_CAPTURE'
      }];
    });
  }

  function sendPendingCommunications(options) {
    options = options || {};
    var opId = requireOperationId('COMMUNICATION_SEND', options);
    var expectedEvents = repositories.communicationRepository.getAll().filter(function(record) {
      return record.ESTADO === 'PENDIENTE';
    }).map(function(record) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-COMUNICACION-' + record.COMUNICACION_ID + '-CAMBIO_ESTADO',
        USUARIO: 'SYSTEM',
        ENTIDAD: 'COMUNICACIONES',
        ENTIDAD_ID: record.COMUNICACION_ID,
        ACCION: 'CAMBIO_ESTADO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: 'PENDIENTE',
        VALOR_NUEVO: 'ENVIADO',
        MOTIVO: 'SEND_ATTEMPT'
      };
    });

    return runAudited(opId, expectedEvents, function() {
      return services.communicationService.sendPendingCommunications();
    }, function(results) {
      return results.filter(function(result) {
        return result && result.communication && !result.skipped && result.communication.ESTADO !== 'PENDIENTE';
      }).map(function(result) {
        return {
          EVENTO_ID: 'AUD-' + opId + '-COMUNICACION-' + result.communication.COMUNICACION_ID + '-CAMBIO_ESTADO',
          USUARIO: 'SYSTEM',
          ENTIDAD: 'COMUNICACIONES',
          ENTIDAD_ID: result.communication.COMUNICACION_ID,
          ACCION: 'CAMBIO_ESTADO',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: 'PENDIENTE',
          VALOR_NUEVO: result.communication.ESTADO,
          MOTIVO: 'SEND_ATTEMPT'
        };
      });
    });
  }

  function retryCommunication(communicationId, options) {
    options = options || {};
    var record = repositories.communicationRepository.getAll().filter(function(candidate) {
      return candidate.COMUNICACION_ID === communicationId;
    })[0] || {};
    var opId = requireOperationId('COMMUNICATION_RETRY', options);
    var expected = [{
      EVENTO_ID: 'AUD-' + opId + '-COMUNICACION-' + communicationId + '-CAMBIO_ESTADO',
      USUARIO: 'SYSTEM',
      ENTIDAD: 'COMUNICACIONES',
      ENTIDAD_ID: communicationId,
      ACCION: 'CAMBIO_ESTADO',
      CAMPO: 'ESTADO',
      VALOR_ANTERIOR: record.ESTADO || 'ERROR',
      VALOR_NUEVO: 'ENVIADO',
      MOTIVO: 'SEND_ATTEMPT'
    }];

    return runAudited(opId, expected, function() {
      return services.communicationService.retryCommunication(communicationId);
    }, function(result) {
      if (result.skipped) {
        return [];
      }
      expected[0].VALOR_NUEVO = result.communication.ESTADO;
      return [expected[0]];
    });
  }

  function generateConvocation(matchId) {
    return services.convocationService.generateConvocation(matchId);
  }

  function generateAbsenceCommunications(attendanceId) {
    return services.communicationService.generateAbsenceCommunications(attendanceId);
  }

  function generateConvocationCommunications(convocationId) {
    return services.communicationService.generateConvocationCommunications(convocationId);
  }

  return {
    approveConvocation: approveConvocation,
    assignPlayerPosition: assignPlayerPosition,
    createParticipation: createParticipation,
    generateAbsenceCommunications: generateAbsenceCommunications,
    generateConvocation: generateConvocation,
    generateConvocationCommunications: generateConvocationCommunications,
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
