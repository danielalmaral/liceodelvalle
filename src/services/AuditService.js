function createAuditService(dependencies) {
  var utils = dependencies.utils;
  var auditRepository = dependencies.auditRepository;
  var idGenerator = dependencies.idGenerator || {};
  var clock = dependencies.clock || { now: function() { return new Date(); } };
  var sensitiveFields = {
    JUSTIFICACION: true,
    OBSERVACIONES: true,
    CUERPO: true,
    DESTINATARIO: true,
    EMAIL: true,
    TELEFONO: true
  };

  function copyRecord(record) {
    var next = {};
    Object.keys(record).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function valueOrEmpty(value) {
    if (value === undefined || value === null) {
      return '';
    }
    return value;
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

  function safeMotive(value, fallback) {
    var text = utils.optionalText(value);
    var allowed = {
      ABSENCE_JUSTIFIED: true,
      INJURY_RECORDED: true,
      ABSENCE_EXPIRED: true,
      STATUS_CHANGE: true,
      HUMAN_APPROVAL: true,
      MANUAL_CHANGE: true,
      POST_MATCH_CAPTURE: true,
      SEND_ATTEMPT: true
    };

    if (allowed[text]) {
      return text;
    }

    return fallback || 'STATUS_CHANGE';
  }

  function normalizeEvent(input) {
    var id = eventId(input);

    if (!id || String(id).trim() === '') {
      throw utils.createDomainError('AUDIT_EVENT_ID_REQUIRED', 'EVENTO_ID');
    }

    var field = sanitize(valueOrEmpty(input.CAMPO !== undefined ? input.CAMPO : input.campo));
    var redact = sensitiveFields[String(field).trim().toUpperCase()];

    return {
      EVENTO_ID: String(id).trim(),
      FECHA_HORA: valueOrEmpty(input.FECHA_HORA !== undefined ? input.FECHA_HORA : input.fechaHora) || clock.now(),
      USUARIO: sanitize(valueOrEmpty(input.USUARIO !== undefined ? input.USUARIO : input.usuario)),
      ENTIDAD: utils.requireText(valueOrEmpty(input.ENTIDAD !== undefined ? input.ENTIDAD : input.entidad), 'ENTIDAD'),
      ENTIDAD_ID: utils.requireText(valueOrEmpty(input.ENTIDAD_ID !== undefined ? input.ENTIDAD_ID : input.entidadId), 'ENTIDAD_ID'),
      ACCION: utils.requireText(valueOrEmpty(input.ACCION !== undefined ? input.ACCION : input.accion), 'ACCION'),
      CAMPO: field,
      VALOR_ANTERIOR: redact ? '[REDACTED]' : sanitize(valueOrEmpty(input.VALOR_ANTERIOR !== undefined ? input.VALOR_ANTERIOR : input.valorAnterior)),
      VALOR_NUEVO: redact ? '[REDACTED]' : sanitize(valueOrEmpty(input.VALOR_NUEVO !== undefined ? input.VALOR_NUEVO : input.valorNuevo)),
      MOTIVO: sanitize(valueOrEmpty(input.MOTIVO !== undefined ? input.MOTIVO : input.motivo))
    };
  }

  function sameAuthoritativePayload(left, right) {
    var keys = ['ENTIDAD', 'ENTIDAD_ID', 'ACCION', 'CAMPO', 'VALOR_ANTERIOR', 'VALOR_NUEVO', 'MOTIVO'];
    var normalizedLeft = normalizeEvent(left);
    var normalizedRight = normalizeEvent(right);

    return keys.every(function(key) {
      return String(normalizedLeft[key]) === String(normalizedRight[key]);
    });
  }

  function appendEvent(input) {
    var event = normalizeEvent(input);
    var existing = auditRepository.getAll().filter(function(record) {
      return record.EVENTO_ID === event.EVENTO_ID;
    })[0] || null;

    if (existing) {
      if (!sameAuthoritativePayload(existing, event)) {
        throw utils.createDomainError('AUDIT_EVENT_ID_CONFLICT', event.EVENTO_ID);
      }
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
      EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + attendanceId + '-TRANSICION_AUSENCIA',
      USUARIO: actor,
      ENTIDAD: 'ASISTENCIAS',
      ENTIDAD_ID: attendanceId,
      ACCION: 'TRANSICION_AUSENCIA',
      CAMPO: 'ESTADO',
      VALOR_ANTERIOR: fromState,
      VALOR_NUEVO: toState,
      MOTIVO: safeMotive(reason, toState === 'FJ' ? 'ABSENCE_JUSTIFIED' : (toState === 'LES' ? 'INJURY_RECORDED' : (toState === 'FI' ? 'ABSENCE_EXPIRED' : 'STATUS_CHANGE')))
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
