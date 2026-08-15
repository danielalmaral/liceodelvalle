function createAuditService(dependencies) {
  var utils = dependencies.utils;
  var auditRepository = dependencies.auditRepository;
  var idGenerator = dependencies.idGenerator || {};
  var clock = dependencies.clock || { now: function() { return new Date(); } };

  function copyRecord(record) {
    var next = {};
    Object.keys(record).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function sanitize(value) {
    var text = utils.optionalText(value);
    if (!text) {
      return '';
    }
    return text
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]')
      .replace(/(?:\+?\d[\s.-]?){10,}/g, '[number]')
      .slice(0, 180);
  }

  function eventId(input) {
    return input.EVENTO_ID || input.eventId || (idGenerator.auditId ? idGenerator.auditId(input) : '');
  }

  function operationId(input, fallback) {
    return input.operationId || input.OPERATION_ID || (idGenerator.operationId ? idGenerator.operationId(input) : fallback);
  }

  function normalizeEvent(input) {
    var id = eventId(input);

    if (!id || String(id).trim() === '') {
      throw utils.createDomainError('AUDIT_EVENT_ID_REQUIRED', 'EVENTO_ID');
    }

    return {
      EVENTO_ID: String(id).trim(),
      FECHA_HORA: input.FECHA_HORA || input.fechaHora || clock.now(),
      USUARIO: sanitize(input.USUARIO || input.usuario),
      ENTIDAD: utils.requireText(input.ENTIDAD || input.entidad, 'ENTIDAD'),
      ENTIDAD_ID: utils.requireText(input.ENTIDAD_ID || input.entidadId, 'ENTIDAD_ID'),
      ACCION: utils.requireText(input.ACCION || input.accion, 'ACCION'),
      CAMPO: sanitize(input.CAMPO || input.campo),
      VALOR_ANTERIOR: sanitize(input.VALOR_ANTERIOR || input.valorAnterior),
      VALOR_NUEVO: sanitize(input.VALOR_NUEVO || input.valorNuevo),
      MOTIVO: sanitize(input.MOTIVO || input.motivo)
    };
  }

  function appendEvent(input) {
    var event = normalizeEvent(input);
    var existing = auditRepository.getAll().filter(function(record) {
      return record.EVENTO_ID === event.EVENTO_ID;
    })[0] || null;

    if (existing) {
      return copyRecord(existing);
    }

    return auditRepository.insert(event);
  }

  function getEvents() {
    var seen = {};
    return auditRepository.getAll().map(normalizeEvent).map(function(event) {
      if (seen[event.EVENTO_ID]) {
        throw utils.createDomainError('AUDIT_DUPLICATE_EVENT_ID', event.EVENTO_ID);
      }
      seen[event.EVENTO_ID] = true;
      return event;
    });
  }

  function appendAfterWrite(writeFn, event) {
    var result = writeFn();
    try {
      appendEvent(event);
    } catch (error) {
      throw utils.createDomainError('AUDIT_PERSISTENCE_FAILED_AFTER_WRITE', event.ENTIDAD_ID || event.entidadId || '');
    }
    return result;
  }

  function recordAbsenceTransition(attendanceId, fromState, toState, actor, reason) {
    var opId = operationId(arguments[5] || {}, 'ABSENCE-' + attendanceId + '-' + fromState + '-' + toState);
    return appendEvent({
      EVENTO_ID: 'AUD-' + opId + '-ASISTENCIAS-TRANSICION_AUSENCIA',
      USUARIO: actor,
      ENTIDAD: 'ASISTENCIAS',
      ENTIDAD_ID: attendanceId,
      ACCION: 'TRANSICION_AUSENCIA',
      CAMPO: 'ESTADO',
      VALOR_ANTERIOR: fromState,
      VALOR_NUEVO: toState,
      MOTIVO: reason || 'STATUS_CHANGE'
    });
  }

  function recordConvocationManualChange(detailId, field, beforeValue, afterValue, actor, reason) {
    var opId = operationId(arguments[6] || {}, 'CONVOCATION-MANUAL-' + detailId + '-' + field);
    return appendEvent({
      EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-CAMBIO_MANUAL',
      USUARIO: actor,
      ENTIDAD: 'CONVOCATORIA_DETALLE',
      ENTIDAD_ID: detailId,
      ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
      CAMPO: field,
      VALOR_ANTERIOR: beforeValue,
      VALOR_NUEVO: afterValue,
      MOTIVO: reason || 'MANUAL_CHANGE'
    });
  }

  function recordConvocationApproval(convocationId, actor) {
    var opId = operationId(arguments[2] || {}, 'CONVOCATION-APPROVAL-' + convocationId);
    return appendEvent({
      EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIAS-APROBACION',
      USUARIO: actor,
      ENTIDAD: 'CONVOCATORIAS',
      ENTIDAD_ID: convocationId,
      ACCION: 'APROBACION',
      CAMPO: 'ESTADO',
      VALOR_ANTERIOR: 'PROPUESTA',
      VALOR_NUEVO: 'APROBADA',
      MOTIVO: 'HUMAN_APPROVAL'
    });
  }

  function recordParticipationUpdate(participationId, field, beforeValue, afterValue, actor) {
    var opId = operationId(arguments[5] || {}, 'PARTICIPATION-' + participationId + '-' + field);
    return appendEvent({
      EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION_PARTIDO-ACTUALIZACION',
      USUARIO: actor,
      ENTIDAD: 'PARTICIPACION_PARTIDO',
      ENTIDAD_ID: participationId,
      ACCION: 'ACTUALIZACION',
      CAMPO: field,
      VALOR_ANTERIOR: beforeValue,
      VALOR_NUEVO: afterValue,
      MOTIVO: 'POST_MATCH_CAPTURE'
    });
  }

  function recordCommunicationState(communicationId, fromState, toState) {
    var opId = operationId(arguments[3] || {}, 'COMMUNICATION-' + communicationId + '-' + toState);
    return appendEvent({
      EVENTO_ID: 'AUD-' + opId + '-COMUNICACIONES-CAMBIO_ESTADO',
      USUARIO: 'SYSTEM',
      ENTIDAD: 'COMUNICACIONES',
      ENTIDAD_ID: communicationId,
      ACCION: 'CAMBIO_ESTADO',
      CAMPO: 'ESTADO',
      VALOR_ANTERIOR: fromState,
      VALOR_NUEVO: toState,
      MOTIVO: 'SEND_ATTEMPT'
    });
  }

  return {
    appendAfterWrite: appendAfterWrite,
    appendEvent: appendEvent,
    getEvents: getEvents,
    recordAbsenceTransition: recordAbsenceTransition,
    recordCommunicationState: recordCommunicationState,
    recordConvocationApproval: recordConvocationApproval,
    recordConvocationManualChange: recordConvocationManualChange,
    recordParticipationUpdate: recordParticipationUpdate
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAuditService };
}
