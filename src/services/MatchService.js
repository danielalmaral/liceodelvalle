function createMatchService(dependencies) {
  var utils = dependencies.utils;
  var matchRepository = dependencies.matchRepository;
  var idGenerator = dependencies.idGenerator || {};

  function copyRecord(record) {
    var next = {};
    Object.keys(record || {}).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function requireMatchRepositoryWrite() {
    if (!matchRepository || typeof matchRepository.insert !== 'function' || typeof matchRepository.updateById !== 'function') {
      throw utils.createDomainError('REPOSITORY_WRITE_REQUIRED', 'PARTIDOS');
    }
  }

  function parseTime(value, fieldName) {
    if (!value) {
      return null;
    }

    var date = new Date('1970-01-01T' + value);

    if (Number.isNaN(date.getTime())) {
      throw utils.createDomainError('INVALID_TIME', fieldName);
    }

    return date;
  }

  function parseOptionalScore(value, fieldName, required) {
    if (value === '' || value === null || value === undefined) {
      if (required) {
        throw utils.createDomainError('MATCH_SCORE_REQUIRED', fieldName);
      }

      return null;
    }

    var score = Number(value);

    if (!Number.isInteger(score) || score < 0) {
      throw utils.createDomainError('MATCH_SCORE_INVALID', fieldName);
    }

    return score;
  }

  function normalizeJornada(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return utils.requireText(value, 'JORNADA');
  }

  function normalizeMatch(row) {
    var callTime = parseTime(row.HORA_CITACION, 'HORA_CITACION');
    var matchTime = parseTime(row.HORA_PARTIDO, 'HORA_PARTIDO');
    var duration = Number(row.DURACION_MINUTOS);
    var estado = utils.assertOneOf(row.ESTADO, MATCH_ENUMS.ESTADO, 'ESTADO');

    if (callTime && matchTime && callTime.getTime() > matchTime.getTime()) {
      throw utils.createDomainError('MATCH_TIME_ORDER', row.PARTIDO_ID);
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      throw utils.createDomainError('MATCH_DURATION_INVALID', row.PARTIDO_ID);
    }

    return {
      partidoId: utils.requireText(row.PARTIDO_ID, 'PARTIDO_ID'),
      competencia: utils.assertOneOf(row.COMPETENCIA, MATCH_ENUMS.COMPETENCIA, 'COMPETENCIA'),
      jornada: normalizeJornada(row.JORNADA),
      rival: utils.requireText(row.RIVAL, 'RIVAL'),
      fecha: utils.parseDateValue(row.FECHA, 'FECHA'),
      horaCitacion: row.HORA_CITACION || '',
      horaPartido: row.HORA_PARTIDO || '',
      sede: utils.requireText(row.SEDE, 'SEDE'),
      localVisitante: utils.assertOneOf(row.LOCAL_VISITANTE, MATCH_ENUMS.LOCAL_VISITANTE, 'LOCAL_VISITANTE'),
      duracionMinutos: duration,
      uniforme: utils.optionalText(row.UNIFORME),
      indicaciones: utils.optionalText(row.INDICACIONES),
      estado: estado,
      golesFavor: parseOptionalScore(row.GOLES_FAVOR, 'GOLES_FAVOR', estado === 'JUGADO'),
      golesContra: parseOptionalScore(row.GOLES_CONTRA, 'GOLES_CONTRA', estado === 'JUGADO'),
      observaciones: utils.optionalText(row.OBSERVACIONES)
    };
  }

  function getMatches() {
    var matches = matchRepository.getAll().map(normalizeMatch);
    utils.assertUnique(matches, function(match) { return match.partidoId; }, 'MATCH_DUPLICATE_ID');
    return matches;
  }

  function getMatchById(matchId) {
    return getMatches().filter(function(match) {
      return match.partidoId === matchId;
    })[0] || null;
  }

  function findRawMatch(matchId) {
    return matchRepository.getAll().filter(function(match) {
      return match.PARTIDO_ID === matchId;
    })[0] || null;
  }

  function rowFromInput(input, base) {
    var row = copyRecord(base || {});
    var matchId = input.PARTIDO_ID || input.partidoId || row.PARTIDO_ID || (idGenerator.matchId ? idGenerator.matchId() : '');

    row.PARTIDO_ID = utils.requireText(matchId, 'PARTIDO_ID');
    row.COMPETENCIA = input.COMPETENCIA || input.competencia || row.COMPETENCIA;
    row.JORNADA = input.JORNADA !== undefined ? input.JORNADA : (input.jornada !== undefined ? input.jornada : row.JORNADA);
    row.RIVAL = input.RIVAL || input.rival || row.RIVAL;
    row.FECHA = input.FECHA || input.fecha || row.FECHA;
    row.HORA_CITACION = input.HORA_CITACION || input.horaCitacion || row.HORA_CITACION || '';
    row.HORA_PARTIDO = input.HORA_PARTIDO || input.horaPartido || row.HORA_PARTIDO || '';
    row.SEDE = input.SEDE || input.sede || row.SEDE;
    row.LOCAL_VISITANTE = input.LOCAL_VISITANTE || input.localVisitante || row.LOCAL_VISITANTE;
    row.DURACION_MINUTOS = input.DURACION_MINUTOS !== undefined ? input.DURACION_MINUTOS : (input.duracionMinutos !== undefined ? input.duracionMinutos : row.DURACION_MINUTOS);
    row.UNIFORME = input.UNIFORME !== undefined ? input.UNIFORME : (input.uniforme !== undefined ? input.uniforme : (row.UNIFORME || ''));
    row.INDICACIONES = input.INDICACIONES !== undefined ? input.INDICACIONES : (input.indicaciones !== undefined ? input.indicaciones : (row.INDICACIONES || ''));
    row.ESTADO = input.ESTADO || input.estado || row.ESTADO || 'PROGRAMADO';
    row.GOLES_FAVOR = input.GOLES_FAVOR !== undefined ? input.GOLES_FAVOR : (input.golesFavor !== undefined ? input.golesFavor : (row.GOLES_FAVOR || ''));
    row.GOLES_CONTRA = input.GOLES_CONTRA !== undefined ? input.GOLES_CONTRA : (input.golesContra !== undefined ? input.golesContra : (row.GOLES_CONTRA || ''));
    row.OBSERVACIONES = input.OBSERVACIONES !== undefined ? input.OBSERVACIONES : (input.observaciones !== undefined ? input.observaciones : (row.OBSERVACIONES || ''));

    normalizeMatch(row);
    return row;
  }

  function assertUniqueMatchId(matchId) {
    matchRepository.getAll().forEach(function(record) {
      if (record.PARTIDO_ID === matchId) {
        throw utils.createDomainError('MATCH_DUPLICATE_ID', matchId);
      }
    });
  }

  function createMatch(input) {
    requireMatchRepositoryWrite();
    var row = rowFromInput(input || {});
    assertUniqueMatchId(row.PARTIDO_ID);
    return matchRepository.insert(row);
  }

  function updateMatch(matchId, updates, actor) {
    requireMatchRepositoryWrite();
    var id = utils.requireText(matchId, 'PARTIDO_ID');
    var current = findRawMatch(id);
    var next;

    if (!current) {
      throw utils.createDomainError('MATCH_NOT_FOUND', id);
    }
    if (current.ESTADO !== 'PROGRAMADO') {
      throw utils.createDomainError('MATCH_UPDATE_STATE_INVALID', id);
    }

    Object.keys(updates || {}).forEach(function(field) {
      var normalized = String(field).toUpperCase();
      if (normalized === 'PARTIDO_ID' || field === 'partidoId') {
        throw utils.createDomainError('MATCH_UPDATE_ID_BYPASS_REJECTED', id);
      }
      if (normalized === 'ESTADO' || field === 'estado') {
        throw utils.createDomainError('MATCH_UPDATE_STATE_BYPASS_REJECTED', id);
      }
      if (normalized === 'GOLES_FAVOR' || normalized === 'GOLES_CONTRA' || field === 'golesFavor' || field === 'golesContra') {
        throw utils.createDomainError('MATCH_UPDATE_SCORE_BYPASS_REJECTED', id);
      }
    });

    next = rowFromInput(updates || {}, current);
    if (next.PARTIDO_ID !== id) {
      throw utils.createDomainError('MATCH_IDENTITY_MUTATION', id);
    }
    return matchRepository.updateById('PARTIDO_ID', id, next);
  }

  function markMatchPlayed(matchId, score, actor) {
    var id = utils.requireText(matchId, 'PARTIDO_ID');
    var current = findRawMatch(id);
    var next;

    requireMatchRepositoryWrite();
    if (!current) {
      throw utils.createDomainError('MATCH_NOT_FOUND', id);
    }
    if (current.ESTADO === 'CANCELADO') {
      throw utils.createDomainError('MATCH_CANCELLED', id);
    }

    next = rowFromInput({
      ESTADO: 'JUGADO',
      GOLES_FAVOR: score && score.GOLES_FAVOR !== undefined ? score.GOLES_FAVOR : score && score.golesFavor,
      GOLES_CONTRA: score && score.GOLES_CONTRA !== undefined ? score.GOLES_CONTRA : score && score.golesContra
    }, current);
    return matchRepository.updateById('PARTIDO_ID', id, next);
  }

  function cancelMatch(matchId, actor) {
    var id = utils.requireText(matchId, 'PARTIDO_ID');
    var current = findRawMatch(id);
    var next;

    requireMatchRepositoryWrite();
    if (!current) {
      throw utils.createDomainError('MATCH_NOT_FOUND', id);
    }
    if (current.ESTADO === 'CANCELADO') {
      throw utils.createDomainError('MATCH_CANCELLED', id);
    }

    next = rowFromInput({ ESTADO: 'CANCELADO', GOLES_FAVOR: '', GOLES_CONTRA: '' }, current);
    return matchRepository.updateById('PARTIDO_ID', id, next);
  }

  return {
    cancelMatch: cancelMatch,
    createMatch: createMatch,
    getMatchById: getMatchById,
    getMatches: getMatches,
    markMatchPlayed: markMatchPlayed,
    updateMatch: updateMatch
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createMatchService };
}
