function createMatchService(dependencies) {
  var utils = dependencies.utils;
  var matchRepository = dependencies.matchRepository;

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
      jornada: utils.requireText(String(row.JORNADA), 'JORNADA'),
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

  return {
    getMatchById: getMatchById,
    getMatches: getMatches
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createMatchService };
}
