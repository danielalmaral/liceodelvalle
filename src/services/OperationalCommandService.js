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

  function stableStringify(value) {
    if (value === undefined || value === null) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }

    if (typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function(key) {
        return JSON.stringify(key) + ':' + stableStringify(value[key]);
      }).join(',') + '}';
    }

    return JSON.stringify(value);
  }

  function intentEvent(operationId, intent, actor) {
    return {
      EVENTO_ID: 'AUD-' + operationId + '-OPERACION-INTENT',
      USUARIO: actor || 'SYSTEM',
      ENTIDAD: 'OPERACION',
      ENTIDAD_ID: operationId,
      ACCION: intent.command,
      CAMPO: 'INTENT',
      VALOR_ANTERIOR: '',
      VALOR_NUEVO: stableStringify(intent),
      MOTIVO: 'OPERATION_INTENT'
    };
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

  function beginAuditedOperation(operationId, intent) {
    var existing = existingEventsFor(operationId);
    var expectedIntent = intentEvent(operationId, intent, intent.actor);
    var existingIntent = null;

    if (existing.length === 0) {
      return { status: 'NEW_OPERATION', events: [] };
    }

    existing.forEach(function(event) {
      if (event.EVENTO_ID === expectedIntent.EVENTO_ID) {
        existingIntent = event;
      }
    });

    if (!existingIntent || !sameEvent(existingIntent, expectedIntent)) {
      throw utils.createDomainError('OPERATION_ID_CONFLICT', operationId);
    }

    return { status: 'IDEMPOTENT_REPLAY', events: existing };
  }

  function appendEvents(events) {
    events.forEach(function(event) {
      services.auditService.appendEvent(event);
    });
  }

  function runAudited(operationId, intent, writeFn, resultEventsFn) {
    var status = beginAuditedOperation(operationId, intent);
    var result;
    var events;

    if (status.status === 'IDEMPOTENT_REPLAY') {
      return { idempotent: true, operationId: operationId, auditEvents: status.events };
    }

    result = writeFn();
    events = [intentEvent(operationId, intent, intent.actor)].concat(resultEventsFn ? resultEventsFn(result) : []);
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
    var intent = {
      actor: options.actor || 'SYSTEM',
      attendanceId: attendanceId,
      command: 'RESOLVE_ABSENCE',
      targetState: targetState
    };

    return runAudited(opId, intent, function() {
      return services.absenceResolutionService.resolveAbsence(attendanceId, targetState, options);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + attendanceId + '-TRANSICION_AUSENCIA',
        USUARIO: options.actor || 'SYSTEM',
        ENTIDAD: 'ASISTENCIAS',
        ENTIDAD_ID: attendanceId,
        ACCION: 'TRANSICION_AUSENCIA',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: before ? before.ESTADO : '',
        VALOR_NUEVO: result.attendance.ESTADO,
        MOTIVO: absenceMotive(result.attendance.ESTADO, options.reason)
      }];
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

    return runAudited(opId, {
      actor: options.actor || 'SYSTEM',
      command: 'RESOLVE_EXPIRED_ABSENCES',
      now: now ? new Date(now).toISOString() : ''
    }, function() {
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
    var normalizedSelected = utils.normalizeStrictBoolean(selected, 'SELECCIONADO_FINAL');
    var intent = {
      actor: options.actor || 'coach',
      command: 'SET_FINAL_SELECTION',
      convocationId: convocationId,
      selected: normalizedSelected,
      studentId: studentId
    };

    return runAudited(opId, intent, function() {
      return services.convocationService.setFinalSelection(convocationId, studentId, selected, reason);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-' + detailId + '-SELECCIONADO_FINAL',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'CONVOCATORIA_DETALLE',
        ENTIDAD_ID: detailId,
        ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
        CAMPO: 'SELECCIONADO_FINAL',
        VALOR_ANTERIOR: before ? before.SELECCIONADO_FINAL : '',
        VALOR_NUEVO: result.SELECCIONADO_FINAL,
        MOTIVO: 'MANUAL_CHANGE'
      }];
    });
  }

  function assignPlayerPosition(convocationId, studentId, position, reason, options) {
    options = options || {};
    var before = getDetail(convocationId, studentId);
    var detailId = before ? before.DETALLE_ID : convocationId + '-' + studentId;
    var opId = requireOperationId('CONVOCATION_POSITION', options);
    var normalizedPosition = String(position || '').trim().toUpperCase();
    var intent = {
      actor: options.actor || 'coach',
      command: 'ASSIGN_POSITION',
      convocationId: convocationId,
      position: normalizedPosition,
      studentId: studentId
    };

    return runAudited(opId, intent, function() {
      return services.convocationService.assignPlayerPosition(convocationId, studentId, position, reason);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-' + detailId + '-POSICION_ASIGNADA',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'CONVOCATORIA_DETALLE',
        ENTIDAD_ID: detailId,
        ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
        CAMPO: 'POSICION_ASIGNADA',
        VALOR_ANTERIOR: before ? before.POSICION_ASIGNADA : '',
        VALOR_NUEVO: result.POSICION_ASIGNADA,
        MOTIVO: 'MANUAL_CHANGE'
      }];
    });
  }

  function approveConvocation(convocationId, actor, options) {
    options = options || {};
    var opId = requireOperationId('CONVOCATION_APPROVAL', options);
    var intent = {
      actor: String(actor || '').trim(),
      command: 'APPROVE_CONVOCATION',
      convocationId: convocationId
    };

    return runAudited(opId, intent, function() {
      return services.convocationService.approveConvocation(convocationId, actor);
    }, function() {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA-' + convocationId + '-APROBACION',
        USUARIO: actor,
        ENTIDAD: 'CONVOCATORIAS',
        ENTIDAD_ID: convocationId,
        ACCION: 'APROBACION',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: 'PROPUESTA',
        VALOR_NUEVO: 'APROBADA',
        MOTIVO: 'HUMAN_APPROVAL'
      }];
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

    return runAudited(opId, {
      actor: options.actor || 'coach',
      command: 'UPDATE_PARTICIPATION',
      participationId: participationId,
      updates: auditedFields.reduce(function(acc, field) {
        if (Object.prototype.hasOwnProperty.call(updates || {}, field)) {
          acc[field] = updates[field];
        }
        return acc;
      }, {})
    }, function() {
      return services.participationService.updateParticipation(participationId, updates);
    }, function(result) {
      return participationEvents(opId, participationId, before, result, options.actor);
    });
  }

  function createParticipation(input, options) {
    options = options || {};
    var opId = requireOperationId('PARTICIPATION_CREATE', options);
    var normalizedInput = copyRecord(input);
    var intent = {
      actor: options.actor || 'coach',
      alumnoId: normalizedInput.ALUMNO_ID || normalizedInput.alumnoId,
      command: 'CREATE_PARTICIPATION',
      convocationId: normalizedInput.CONVOCATORIA_ID || normalizedInput.convocationId,
      matchId: normalizedInput.PARTIDO_ID || normalizedInput.matchId,
      requestedParticipationId: normalizedInput.PARTICIPACION_ID || normalizedInput.participacionId || ''
    };

    return runAudited(opId, intent, function() {
      var participationId = normalizedInput.PARTICIPACION_ID || normalizedInput.participacionId || (idGenerator.participationId ? idGenerator.participationId() : '');
      normalizedInput.PARTICIPACION_ID = participationId;
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

    return runAudited(opId, {
      command: 'SEND_PENDING_COMMUNICATIONS',
      communicationIds: expectedEvents.map(function(event) { return event.ENTIDAD_ID; }).sort()
    }, function() {
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
    var beforeState = record.ESTADO || 'ERROR';

    return runAudited(opId, {
      command: 'RETRY_COMMUNICATION',
      communicationId: communicationId
    }, function() {
      return services.communicationService.retryCommunication(communicationId);
    }, function(result) {
      if (result.skipped) {
        return [];
      }
      return [{
        EVENTO_ID: 'AUD-' + opId + '-COMUNICACION-' + communicationId + '-CAMBIO_ESTADO',
        USUARIO: 'SYSTEM',
        ENTIDAD: 'COMUNICACIONES',
        ENTIDAD_ID: communicationId,
        ACCION: 'CAMBIO_ESTADO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: beforeState,
        VALOR_NUEVO: result.communication.ESTADO,
        MOTIVO: 'SEND_ATTEMPT'
      }];
    });
  }

  function generateConvocation(matchId, actor) {
    return services.convocationService.generateConvocation(matchId, actor);
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
