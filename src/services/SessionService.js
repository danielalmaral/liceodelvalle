function createSessionService(dependencies) {
  var utils = dependencies.utils;
  var sessionRepository = dependencies.sessionRepository;
  var matchService = dependencies.matchService;
  var idGenerator = dependencies.idGenerator || {};
  var clock = dependencies.clock || { now: function() { return new Date(); } };

  function copyRecord(record) {
    var next = {};
    Object.keys(record || {}).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function requireSessionRepositoryWrite() {
    if (!sessionRepository || typeof sessionRepository.insert !== 'function' || typeof sessionRepository.updateById !== 'function') {
      throw utils.createDomainError('REPOSITORY_WRITE_REQUIRED', 'SESIONES');
    }
  }

  function parseTime(value, fieldName, required) {
    if (value === undefined || value === null || value === '') {
      if (required) {
        throw utils.createDomainError('REQUIRED_FIELD', fieldName);
      }
      return '';
    }

    var text = String(value).trim();
    var date = new Date('1970-01-01T' + text);

    if (Number.isNaN(date.getTime())) {
      throw utils.createDomainError('INVALID_TIME', fieldName);
    }

    return text;
  }

  function assertUniqueSessionId(sessionId) {
    sessionRepository.getAll().forEach(function(record) {
      if (record.SESION_ID === sessionId) {
        throw utils.createDomainError('SESSION_DUPLICATE_ID', sessionId);
      }
    });
  }

  function findRawSession(sessionId) {
    return sessionRepository.getAll().filter(function(record) {
      return record.SESION_ID === sessionId;
    })[0] || null;
  }

  function assertTimeOrder(start, end, sessionId) {
    if (!start || !end) {
      return;
    }

    if (new Date('1970-01-01T' + end).getTime() < new Date('1970-01-01T' + start).getTime()) {
      throw utils.createDomainError('SESSION_TIME_RANGE', sessionId);
    }
  }

  function normalizeCreateInput(input) {
    var sessionId = input.SESION_ID || input.sesionId || (idGenerator.sessionId ? idGenerator.sessionId() : '');
    var tipo = utils.assertOneOf(input.TIPO || input.tipo, SESSION_ENUMS.TIPO, 'TIPO');
    var competencia = tipo === 'ENTRENAMIENTO'
      ? (input.COMPETENCIA || input.competencia || 'GENERAL')
      : (input.COMPETENCIA || input.competencia);
    var partidoId = utils.optionalText(input.PARTIDO_ID || input.partidoId);
    var start = parseTime(input.HORA_INICIO || input.horaInicio, 'HORA_INICIO', true);
    var end = parseTime(input.HORA_FIN || input.horaFin, 'HORA_FIN', false);
    var match;

    sessionId = utils.requireText(sessionId, 'SESION_ID');
    competencia = utils.assertOneOf(competencia, SESSION_ENUMS.COMPETENCIA, 'COMPETENCIA');
    assertTimeOrder(start, end, sessionId);

    if (tipo === 'ENTRENAMIENTO') {
      if (partidoId) {
        throw utils.createDomainError('SESSION_TRAINING_MATCH_NOT_EMPTY', sessionId);
      }
      if (competencia !== 'GENERAL') {
        throw utils.createDomainError('SESSION_TRAINING_COMPETITION_INVALID', sessionId);
      }
    }

    if (tipo === 'PARTIDO') {
      if (!partidoId) {
        throw utils.createDomainError('SESSION_MATCH_REQUIRED', sessionId);
      }
      if (competencia === 'GENERAL') {
        throw utils.createDomainError('SESSION_MATCH_COMPETITION_INVALID', sessionId);
      }
      match = matchService.getMatchById(partidoId);
      if (!match) {
        throw utils.createDomainError('SESSION_MATCH_FK', partidoId);
      }
      if (match.competencia !== competencia) {
        throw utils.createDomainError('SESSION_MATCH_COMPETITION_ALIGNMENT', sessionId);
      }
    }

    return {
      SESION_ID: sessionId,
      TIPO: tipo,
      FECHA: utils.parseDateValue(input.FECHA || input.fecha, 'FECHA'),
      HORA_INICIO: start,
      HORA_FIN: end,
      COMPETENCIA: competencia,
      PARTIDO_ID: partidoId,
      DESCRIPCION: utils.optionalText(input.DESCRIPCION || input.descripcion),
      ESTADO: 'ABIERTA',
      CREADA_EN: input.CREADA_EN || input.creadaEn || clock.now(),
      CERRADA_EN: ''
    };
  }

  function createSession(input) {
    requireSessionRepositoryWrite();
    var record = normalizeCreateInput(input || {});
    assertUniqueSessionId(record.SESION_ID);
    return sessionRepository.insert(record);
  }

  function closeSession(sessionId, actor) {
    requireSessionRepositoryWrite();
    var id = utils.requireText(sessionId, 'SESION_ID');
    var current = findRawSession(id);
    var next;

    if (!current) {
      throw utils.createDomainError('SESSION_NOT_FOUND', id);
    }

    if (current.ESTADO !== 'ABIERTA') {
      throw utils.createDomainError('SESSION_DOUBLE_CLOSE_REJECTED', id);
    }

    next = copyRecord(current);
    next.ESTADO = 'CERRADA';
    next.CERRADA_EN = clock.now();
    return sessionRepository.updateById('SESION_ID', id, next);
  }

  return {
    closeSession: closeSession,
    createSession: createSession
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createSessionService };
}
