function createCommunicationService(dependencies) {
  var utils = dependencies.utils;
  var communicationRepository = dependencies.communicationRepository;
  var attendanceRepository = dependencies.attendanceRepository;
  var tutorRepository = dependencies.tutorRepository;
  var studentRepository = dependencies.studentRepository;
  var convocationRepository = dependencies.convocationRepository;
  var detailRepository = dependencies.detailRepository;
  var matchService = dependencies.matchService;
  var configService = dependencies.configService;
  var mailAdapter = dependencies.mailAdapter || { send: function() { throw utils.createDomainError('MAIL_ADAPTER_REQUIRED', 'send'); } };
  var idGenerator = dependencies.idGenerator || {};
  var clock = dependencies.clock || { now: function() { return new Date(); } };

  function copyRecord(record) {
    var next = {};
    Object.keys(record).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function normalizeBoolean(value) {
    try {
      return utils.normalizeStrictBoolean(value, 'COMUNICACIONES');
    } catch (error) {
      throw utils.createDomainError('COMMUNICATION_TUTOR_BOOLEAN_INVALID', 'COMUNICACIONES');
    }
  }

  function getStudent(studentId) {
    return studentRepository.getAll().filter(function(student) {
      return student.ALUMNO_ID === studentId;
    })[0] || null;
  }

  function studentName(studentId) {
    var student = getStudent(studentId);
    if (!student) {
      return studentId;
    }
    return [student.NOMBRE || student.NOMBRES || '', student.APELLIDOS || ''].join(' ').trim() || studentId;
  }

  function eligibleTutors(studentId, flagField) {
    return tutorRepository.getAll().filter(function(tutor) {
      return tutor.ALUMNO_ID === studentId && normalizeBoolean(tutor.ACTIVO) && normalizeBoolean(tutor[flagField]) && utils.isValidEmail(tutor.EMAIL);
    });
  }

  function existingCommunication(tipo, referenceId, studentId, tutorId) {
    var matches = communicationRepository.getAll().filter(function(record) {
      return record.TIPO === tipo && record.REFERENCIA_ID === referenceId && record.ALUMNO_ID === studentId && record.TUTOR_ID === tutorId;
    });

    if (matches.length > 1) {
      throw utils.createDomainError('COMMUNICATION_DUPLICATE_LOGICAL_KEY', [tipo, referenceId, studentId, tutorId].join('|'));
    }

    return matches[0] || null;
  }

  function assertUniqueCommunicationId(id) {
    communicationRepository.getAll().forEach(function(record) {
      if (record.COMUNICACION_ID === id) {
        throw utils.createDomainError('COMMUNICATION_DUPLICATE_ID', id);
      }
    });
  }

  function nextCommunicationId(tipo, referenceId, studentId, tutorId) {
    var generated = idGenerator.communicationId ? idGenerator.communicationId(tipo, referenceId, studentId, tutorId) : '';
    return generated || ['COM', tipo, referenceId, studentId, tutorId].join('-');
  }

  function normalizeCommunication(record) {
    var recipient = utils.normalizeEmail(record.DESTINATARIO);
    var attempts = Number(record.INTENTOS || 0);

    if (!utils.isValidEmail(recipient)) {
      throw utils.createDomainError('COMMUNICATION_RECIPIENT_INVALID', 'DESTINATARIO');
    }

    if (!Number.isInteger(attempts) || attempts < 0) {
      throw utils.createDomainError('COMMUNICATION_ATTEMPTS_INVALID', 'INTENTOS');
    }

    return {
      COMUNICACION_ID: utils.requireText(record.COMUNICACION_ID, 'COMUNICACION_ID'),
      TIPO: utils.assertOneOf(record.TIPO, COMMUNICATION_ENUMS.TIPO, 'TIPO'),
      ALUMNO_ID: utils.requireText(record.ALUMNO_ID, 'ALUMNO_ID'),
      TUTOR_ID: utils.requireText(record.TUTOR_ID, 'TUTOR_ID'),
      REFERENCIA_ID: utils.requireText(record.REFERENCIA_ID, 'REFERENCIA_ID'),
      DESTINATARIO: recipient,
      ASUNTO: utils.requireText(record.ASUNTO, 'ASUNTO'),
      CUERPO: utils.requireText(record.CUERPO, 'CUERPO'),
      CREADO_EN: record.CREADO_EN || clock.now(),
      ENVIADO_EN: record.ENVIADO_EN || '',
      ESTADO: utils.assertOneOf(record.ESTADO, COMMUNICATION_ENUMS.ESTADO, 'ESTADO'),
      ERROR: utils.optionalText(record.ERROR),
      INTENTOS: attempts
    };
  }

  function insertCommunication(record) {
    var normalized = normalizeCommunication(record);
    assertUniqueCommunicationId(normalized.COMUNICACION_ID);
    return communicationRepository.insert(normalized);
  }

  function createIfMissing(tipo, referenceId, studentId, tutor, subject, body) {
    var existing = existingCommunication(tipo, referenceId, studentId, tutor.TUTOR_ID);
    if (existing) {
      return existing;
    }

    return insertCommunication({
      COMUNICACION_ID: nextCommunicationId(tipo, referenceId, studentId, tutor.TUTOR_ID),
      TIPO: tipo,
      ALUMNO_ID: studentId,
      TUTOR_ID: tutor.TUTOR_ID,
      REFERENCIA_ID: referenceId,
      DESTINATARIO: tutor.EMAIL,
      ASUNTO: subject,
      CUERPO: body,
      CREADO_EN: clock.now(),
      ENVIADO_EN: '',
      ESTADO: 'PENDIENTE',
      ERROR: '',
      INTENTOS: 0
    });
  }

  function generateAbsenceCommunications(attendanceId) {
    var created = [];
    var attendance;
    var body;

    if (!configService.getBoolean('AVISO_AUSENCIA_EMAIL')) {
      return { created: created, skipped: true };
    }

    attendance = attendanceRepository.getAll().filter(function(record) {
      return record.ASISTENCIA_ID === attendanceId;
    })[0] || null;

    if (!attendance) {
      throw utils.createDomainError('COMMUNICATION_ABSENCE_NOT_FOUND', attendanceId);
    }

    if (attendance.ESTADO !== 'F') {
      throw utils.createDomainError('COMMUNICATION_ABSENCE_SOURCE_INVALID', attendanceId);
    }

    body = 'Hoy ' + studentName(attendance.ALUMNO_ID) + ' no registro asistencia. Si existe motivo o justificacion, por favor informenos para actualizar el registro.';
    eligibleTutors(attendance.ALUMNO_ID, 'RECIBE_AUSENCIAS').forEach(function(tutor) {
      created.push(createIfMissing('AUSENCIA', attendanceId, attendance.ALUMNO_ID, tutor, 'Aviso de asistencia', body));
    });

    return { created: created, skipped: false };
  }

  function getConvocation(convocationId) {
    return convocationRepository.getAll().filter(function(convocation) {
      return convocation.CONVOCATORIA_ID === convocationId;
    })[0] || null;
  }

  function generateConvocationCommunications(convocationId) {
    var created = [];
    var convocation;
    var match;

    if (!configService.getBoolean('CONVOCATORIA_EMAIL')) {
      return { created: created, skipped: true };
    }

    convocation = getConvocation(convocationId);
    if (!convocation || convocation.ESTADO !== 'APROBADA') {
      return { created: created, skipped: true };
    }

    match = matchService.getMatchById(convocation.PARTIDO_ID);
    if (!match) {
      throw utils.createDomainError('COMMUNICATION_MATCH_NOT_FOUND', convocation.PARTIDO_ID);
    }

    detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId && utils.normalizeStrictBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL');
    }).forEach(function(detail) {
      var body = [
        studentName(detail.ALUMNO_ID),
        'Competencia: ' + convocation.COMPETENCIA,
        'Rival: ' + match.rival,
        'Fecha: ' + match.fecha.toISOString().slice(0, 10),
        'Citacion: ' + match.horaCitacion,
        'Partido: ' + match.horaPartido,
        'Sede: ' + match.sede,
        'Uniforme: ' + match.uniforme,
        'Indicaciones: ' + match.indicaciones
      ].join('\n');

      eligibleTutors(detail.ALUMNO_ID, 'RECIBE_CONVOCATORIAS').forEach(function(tutor) {
        created.push(createIfMissing('CONVOCATORIA', convocationId, detail.ALUMNO_ID, tutor, 'Convocatoria ' + convocation.COMPETENCIA, body));
      });
    });

    return { created: created, skipped: false };
  }

  function sanitizeError(error) {
    var text = String(error && error.message ? error.message : error || 'SEND_ERROR');
    return text
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]')
      .replace(/(?:\+?\d[\s.-]?){10,}/g, '[number]')
      .slice(0, 160);
  }

  function markAbsenceSummaryPointer(record) {
    if (record.TIPO !== 'AUSENCIA' || !attendanceRepository || typeof attendanceRepository.updateById !== 'function') {
      return;
    }

    var attendance = attendanceRepository.getAll().filter(function(candidate) {
      return candidate.ASISTENCIA_ID === record.REFERENCIA_ID;
    })[0] || null;

    if (attendance) {
      var next = copyRecord(attendance);
      next.AVISO_ENVIADO = true;
      next.COMUNICACION_ID = record.COMUNICACION_ID;
      attendanceRepository.updateById('ASISTENCIA_ID', attendance.ASISTENCIA_ID, next);
    }
  }

  function canSendByConfig(record) {
    if (record.TIPO === 'AUSENCIA') {
      return configService.getBoolean('AVISO_AUSENCIA_EMAIL');
    }

    if (record.TIPO === 'CONVOCATORIA') {
      return configService.getBoolean('CONVOCATORIA_EMAIL');
    }

    return false;
  }

  function sendCommunication(record) {
    var next = copyRecord(record);
    var attempt = copyRecord(record);

    if (!canSendByConfig(record)) {
      return { ok: true, skipped: true, communication: next };
    }

    attempt.ESTADO = 'ERROR';
    attempt.ERROR = 'DELIVERY_ATTEMPT_IN_PROGRESS';
    attempt.INTENTOS = Number(record.INTENTOS || 0) + 1;
    communicationRepository.updateById('COMUNICACION_ID', record.COMUNICACION_ID, normalizeCommunication(attempt));

    try {
      mailAdapter.send({ to: record.DESTINATARIO, subject: record.ASUNTO, body: record.CUERPO });
      next.ESTADO = 'ENVIADO';
      next.ENVIADO_EN = clock.now();
      next.ERROR = '';
      next.INTENTOS = attempt.INTENTOS;
      try {
        communicationRepository.updateById('COMUNICACION_ID', record.COMUNICACION_ID, normalizeCommunication(next));
      } catch (persistError) {
        return {
          ok: false,
          uncertain: true,
          code: 'COMMUNICATION_DELIVERY_STATE_UNCERTAIN',
          communication: normalizeCommunication(attempt)
        };
      }
      try {
        markAbsenceSummaryPointer(next);
      } catch (pointerError) {
        return { ok: true, warning: 'COMMUNICATION_SUMMARY_POINTER_FAILED', communication: next };
      }
      return { ok: true, communication: next };
    } catch (error) {
      next.ESTADO = 'ERROR';
      next.ERROR = sanitizeError(error);
      next.INTENTOS = attempt.INTENTOS;
      communicationRepository.updateById('COMUNICACION_ID', record.COMUNICACION_ID, normalizeCommunication(next));
      return { ok: false, communication: next };
    }
  }

  function sendPendingCommunications() {
    var results = [];
    getCommunications().filter(function(record) {
      return record.ESTADO === 'PENDIENTE';
    }).forEach(function(record) {
      results.push(sendCommunication(record));
    });
    return results;
  }

  function retryCommunication(communicationId) {
    var record = communicationRepository.getAll().filter(function(candidate) {
      return candidate.COMUNICACION_ID === communicationId;
    })[0] || null;

    if (!record) {
      throw utils.createDomainError('COMMUNICATION_NOT_FOUND', communicationId);
    }

    if (record.ESTADO !== 'ERROR') {
      throw utils.createDomainError('COMMUNICATION_RETRY_INVALID_STATE', communicationId);
    }

    if (record.ERROR === 'DELIVERY_ATTEMPT_IN_PROGRESS') {
      throw utils.createDomainError('COMMUNICATION_DELIVERY_STATE_UNCERTAIN', communicationId);
    }

    if (!canSendByConfig(record)) {
      return { ok: true, skipped: true, communication: copyRecord(record) };
    }

    record = copyRecord(record);
    return sendCommunication(record);
  }

  function getCommunications() {
    var seen = {};
    var seenLogical = {};
    return communicationRepository.getAll().map(normalizeCommunication).map(function(record) {
      var logicalKey = [record.TIPO, record.REFERENCIA_ID, record.ALUMNO_ID, record.TUTOR_ID].join('|');

      if (seen[record.COMUNICACION_ID]) {
        throw utils.createDomainError('COMMUNICATION_DUPLICATE_ID', record.COMUNICACION_ID);
      }
      seen[record.COMUNICACION_ID] = true;

      if (seenLogical[logicalKey]) {
        throw utils.createDomainError('COMMUNICATION_DUPLICATE_LOGICAL_KEY', logicalKey);
      }
      seenLogical[logicalKey] = true;

      return record;
    });
  }

  return {
    generateAbsenceCommunications: generateAbsenceCommunications,
    generateConvocationCommunications: generateConvocationCommunications,
    getCommunications: getCommunications,
    retryCommunication: retryCommunication,
    sendPendingCommunications: sendPendingCommunications
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createCommunicationService };
}
