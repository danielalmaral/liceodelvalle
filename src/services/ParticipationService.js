function createParticipationService(dependencies) {
  var utils = dependencies.utils;
  var participationRepository = dependencies.participationRepository;
  var matchService = dependencies.matchService;
  var convocationRepository = dependencies.convocationRepository;
  var detailRepository = dependencies.detailRepository;
  var studentRepository = dependencies.studentRepository;
  var attendanceService = dependencies.attendanceService;
  var configService = dependencies.configService;
  var idGenerator = dependencies.idGenerator || {};
  var clock = dependencies.clock || { now: function() { return new Date(); } };
  var AUTHORITATIVE_CONVOCATION_STATES = ['APROBADA', 'ENVIADA', 'CERRADA'];

  function copyRecord(record) {
    var next = {};
    Object.keys(record).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function normalizeBoolean(value, fieldName) {
    try {
      return utils.normalizeStrictBoolean(value, fieldName);
    } catch (error) {
      throw utils.createDomainError('PARTICIPATION_BOOLEAN_INVALID', fieldName);
    }
  }

  function nonNegativeInteger(value, fieldName) {
    var number = Number(value);

    if (!Number.isInteger(number) || number < 0) {
      throw utils.createDomainError('PARTICIPATION_INTEGER_INVALID', fieldName);
    }

    return number;
  }

  function optionalRating(value) {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    var number = Number(value);
    var min = configService.getInteger('ESCALA_CALIFICACION_MIN');
    var max = configService.getInteger('ESCALA_CALIFICACION_MAX');
    var decimals = configService.getBoolean('CALIFICACION_DECIMALES');

    if (!Number.isFinite(number) || number < min || number > max) {
      throw utils.createDomainError('PARTICIPATION_RATING_INVALID', 'CALIFICACION');
    }

    if (!decimals && !Number.isInteger(number)) {
      throw utils.createDomainError('PARTICIPATION_RATING_DECIMALS_INVALID', 'CALIFICACION');
    }

    return number;
  }

  function getConvocationById(convocationId) {
    return convocationRepository.getAll().filter(function(convocation) {
      return convocation.CONVOCATORIA_ID === convocationId;
    })[0] || null;
  }

  function getSelectedDetail(convocationId, studentId) {
    return detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId && detail.ALUMNO_ID === studentId && normalizeBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL');
    })[0] || null;
  }

  function assertStudentExists(studentId) {
    var found = studentRepository.getAll().some(function(student) {
      return student.ALUMNO_ID === studentId;
    });

    if (!found) {
      throw utils.createDomainError('PARTICIPATION_STUDENT_FK', studentId);
    }
  }

  function getMatchSession(matchId) {
    var sessions = attendanceService.getSessions().filter(function(session) {
      return session.tipo === 'PARTIDO' && session.partidoId === matchId;
    });

    if (sessions.length === 0) {
      throw utils.createDomainError('PARTICIPATION_MATCH_SESSION_REQUIRED', matchId);
    }

    return sessions[0];
  }

  function getAttendanceFor(matchId, studentId) {
    var session = getMatchSession(matchId);
    var attendance = attendanceService.getAttendances().filter(function(candidate) {
      return candidate.sesionId === session.sesionId && candidate.alumnoId === studentId;
    })[0] || null;

    if (!attendance) {
      throw utils.createDomainError('PARTICIPATION_ATTENDANCE_REQUIRED', matchId + '|' + studentId);
    }

    return attendance;
  }

  function assertUniqueParticipation(participationId, matchId, studentId, currentId) {
    participationRepository.getAll().forEach(function(record) {
      if (record.PARTICIPACION_ID === participationId && record.PARTICIPACION_ID !== currentId) {
        throw utils.createDomainError('PARTICIPATION_DUPLICATE_ID', participationId);
      }

      if (record.PARTIDO_ID === matchId && record.ALUMNO_ID === studentId && record.PARTICIPACION_ID !== currentId) {
        throw utils.createDomainError('PARTICIPATION_DUPLICATE_MATCH_PLAYER', matchId + '|' + studentId);
      }
    });
  }

  function normalizeParticipation(input, currentId) {
    var participationId = input.PARTICIPACION_ID || input.participacionId || (idGenerator.participationId ? idGenerator.participationId() : '');
    var matchId = utils.requireText(input.PARTIDO_ID || input.partidoId, 'PARTIDO_ID');
    var studentId = utils.requireText(input.ALUMNO_ID || input.alumnoId, 'ALUMNO_ID');
    var convocationId = utils.requireText(input.CONVOCATORIA_ID || input.convocationId, 'CONVOCATORIA_ID');
    var match = matchService.getMatchById(matchId);
    var convocation = getConvocationById(convocationId);
    var attended = normalizeBoolean(input.ASISTIO, 'ASISTIO');
    var attendanceState = utils.assertOneOf(input.ASISTENCIA_ESTADO, PARTICIPATION_ENUMS.ASISTENCIA_ESTADO, 'ASISTENCIA_ESTADO');
    var condition = utils.optionalText(input.CONDICION_INICIAL);
    var minutes = nonNegativeInteger(input.MINUTOS_JUGADOS, 'MINUTOS_JUGADOS');
    var goals = nonNegativeInteger(input.GOLES, 'GOLES');
    var yellow = nonNegativeInteger(input.AMARILLAS, 'AMARILLAS');
    var red = nonNegativeInteger(input.ROJAS, 'ROJAS');
    var rating = optionalRating(input.CALIFICACION);
    var attendance;

    if (!participationId || String(participationId).trim() === '') {
      throw utils.createDomainError('PARTICIPATION_ID_REQUIRED', 'PARTICIPACION_ID');
    }

    if (!match) {
      throw utils.createDomainError('PARTICIPATION_MATCH_FK', matchId);
    }

    if (match.estado === 'CANCELADO') {
      throw utils.createDomainError('PARTICIPATION_MATCH_CANCELLED', matchId);
    }

    if (!convocation) {
      throw utils.createDomainError('PARTICIPATION_CONVOCATION_FK', convocationId);
    }

    if (convocation.PARTIDO_ID !== matchId || AUTHORITATIVE_CONVOCATION_STATES.indexOf(convocation.ESTADO) === -1) {
      throw utils.createDomainError('PARTICIPATION_CONVOCATION_INVALID', convocationId);
    }

    assertStudentExists(studentId);

    if (!getSelectedDetail(convocationId, studentId)) {
      throw utils.createDomainError('PARTICIPATION_PLAYER_NOT_SELECTED', studentId);
    }

    if (attended) {
      condition = utils.assertOneOf(condition, PARTICIPATION_ENUMS.CONDICION_INICIAL, 'CONDICION_INICIAL');
    } else {
      condition = '';
      if (minutes !== 0) {
        throw utils.createDomainError('PARTICIPATION_ABSENT_MINUTES', studentId);
      }
      if (rating !== '') {
        throw utils.createDomainError('PARTICIPATION_ABSENT_RATING', studentId);
      }
    }

    if (minutes > match.duracionMinutos) {
      throw utils.createDomainError('PARTICIPATION_MINUTES_RANGE', studentId);
    }

    if (red > 1) {
      throw utils.createDomainError('PARTICIPATION_RED_MAX', studentId);
    }

    attendance = getAttendanceFor(matchId, studentId);
    if (attendance.estado !== attendanceState) {
      throw utils.createDomainError('PARTICIPATION_ATTENDANCE_STATE_MISMATCH', studentId);
    }

    if ((attendanceState === 'A' || attendanceState === 'R') !== attended) {
      throw utils.createDomainError('PARTICIPATION_ATTENDANCE_PRESENCE_MISMATCH', studentId);
    }

    if (!attended && (goals !== 0 || yellow !== 0 || red !== 0)) {
      throw utils.createDomainError('PARTICIPATION_ABSENT_STATS', studentId);
    }

    assertUniqueParticipation(participationId, matchId, studentId, currentId || '');

    return {
      PARTICIPACION_ID: String(participationId).trim(),
      PARTIDO_ID: matchId,
      ALUMNO_ID: studentId,
      CONVOCATORIA_ID: convocationId,
      ASISTIO: attended,
      ASISTENCIA_ESTADO: attendanceState,
      CONDICION_INICIAL: condition,
      MINUTOS_JUGADOS: minutes,
      GOLES: goals,
      AMARILLAS: yellow,
      ROJAS: red,
      CALIFICACION: rating,
      OBSERVACIONES: utils.optionalText(input.OBSERVACIONES),
      REGISTRADO_EN: input.REGISTRADO_EN || clock.now(),
      MODIFICADO_EN: clock.now()
    };
  }

  function getParticipations() {
    var records = participationRepository.getAll().map(copyRecord);
    var seenIds = {};
    var seenPairs = {};

    records.forEach(function(record) {
      if (!record.PARTICIPACION_ID || seenIds[record.PARTICIPACION_ID]) {
        throw utils.createDomainError('PARTICIPATION_DUPLICATE_ID', record.PARTICIPACION_ID || '');
      }
      seenIds[record.PARTICIPACION_ID] = true;

      var pair = record.PARTIDO_ID + '|' + record.ALUMNO_ID;
      if (seenPairs[pair]) {
        throw utils.createDomainError('PARTICIPATION_DUPLICATE_MATCH_PLAYER', pair);
      }
      seenPairs[pair] = true;
    });

    return records;
  }

  function createParticipation(input) {
    var record = normalizeParticipation(input);
    return participationRepository.insert(record);
  }

  function updateParticipation(participationId, updates) {
    var current = getParticipations().filter(function(record) {
      return record.PARTICIPACION_ID === participationId;
    })[0];

    if (!current) {
      throw utils.createDomainError('PARTICIPATION_NOT_FOUND', participationId);
    }

    return participationRepository.updateById('PARTICIPACION_ID', participationId, normalizeParticipation(Object.assign(copyRecord(current), updates), participationId));
  }

  function redCardAlerts(records) {
    if (!configService.getBoolean('ROJA_BLOQUEA_CONVOCATORIA')) {
      return [];
    }

    return records.filter(function(record) {
      return Number(record.ROJAS) > 0;
    }).map(function(record) {
      return { code: 'RED_CARD_REVIEW_REQUIRED', studentId: record.ALUMNO_ID, matchId: record.PARTIDO_ID };
    });
  }

  function lowParticipationAlerts(matchId, currentRecords) {
    var match = matchService.getMatchById(matchId);
    var enabled = match && configService.getBoolean(match.competencia === 'A' ? 'CONTROL_MINUTOS_A' : 'CONTROL_MINUTOS_B');
    var threshold = configService.getInteger('ALERTA_SUPLENCIAS_CONSECUTIVAS');
    var alerts = [];
    var matchById = {};
    var authoritativeByMatch = {};
    var participationByPair = {};

    if (!enabled) {
      return alerts;
    }

    matchService.getMatches().forEach(function(candidate) {
      matchById[candidate.partidoId] = candidate;
    });

    convocationRepository.getAll().forEach(function(convocation) {
      var candidateMatch = matchById[convocation.PARTIDO_ID];
      if (
        candidateMatch &&
        candidateMatch.competencia === match.competencia &&
        candidateMatch.estado !== 'CANCELADO' &&
        AUTHORITATIVE_CONVOCATION_STATES.indexOf(convocation.ESTADO) !== -1
      ) {
        authoritativeByMatch[convocation.PARTIDO_ID] = convocation.CONVOCATORIA_ID;
      }
    });

    getParticipations().forEach(function(record) {
      participationByPair[record.PARTIDO_ID + '|' + record.ALUMNO_ID] = record;
    });

    function selectedFor(convocationId, studentId) {
      return detailRepository.getAll().some(function(detail) {
        return detail.CONVOCATORIA_ID === convocationId && detail.ALUMNO_ID === studentId && normalizeBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL');
      });
    }

    function sortedRelevantMatches() {
      return matchService.getMatches().filter(function(candidate) {
        return authoritativeByMatch[candidate.partidoId] && candidate.competencia === match.competencia && candidate.fecha.getTime() <= match.fecha.getTime();
      }).sort(function(left, right) {
        if (left.fecha.getTime() !== right.fecha.getTime()) {
          return left.fecha.getTime() - right.fecha.getTime();
        }
        if (left.horaPartido !== right.horaPartido) {
          return String(left.horaPartido).localeCompare(String(right.horaPartido));
        }
        return String(left.partidoId).localeCompare(String(right.partidoId));
      });
    }

    currentRecords.forEach(function(record) {
      var zeroCount = 0;
      var history = sortedRelevantMatches().reverse();

      history.some(function(candidateMatch) {
        var convocationId = authoritativeByMatch[candidateMatch.partidoId];
        var participation;

        if (!selectedFor(convocationId, record.ALUMNO_ID)) {
          return false;
        }

        participation = candidateMatch.partidoId === matchId ? record : participationByPair[candidateMatch.partidoId + '|' + record.ALUMNO_ID];
        if (!participation || Number(participation.MINUTOS_JUGADOS) > 0) {
          return true;
        }

        if (Number(participation.MINUTOS_JUGADOS) === 0) {
          zeroCount += 1;
        }
        return false;
      });

      if (zeroCount >= threshold) {
        alerts.push({ code: 'LOW_PARTICIPATION_STREAK', studentId: record.ALUMNO_ID, matchId: matchId });
      }
    });

    return alerts;
  }

  function validateMatchParticipationReadiness(matchId) {
    var match = matchService.getMatchById(matchId);
    var authoritative = {};
    var selected = {};
    var present = {};
    var errors = [];
    var currentRecords;

    if (!match) {
      throw utils.createDomainError('PARTICIPATION_MATCH_FK', matchId);
    }

    if (match.estado !== 'JUGADO') {
      return { ready: false, errors: ['MATCH_NOT_PLAYED'], alerts: [] };
    }

    convocationRepository.getAll().forEach(function(convocation) {
      if (convocation.PARTIDO_ID === matchId && AUTHORITATIVE_CONVOCATION_STATES.indexOf(convocation.ESTADO) !== -1) {
        authoritative[convocation.CONVOCATORIA_ID] = true;
      }
    });

    detailRepository.getAll().forEach(function(detail) {
      if (authoritative[detail.CONVOCATORIA_ID] && normalizeBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL')) {
        selected[detail.ALUMNO_ID] = detail.CONVOCATORIA_ID;
      }
    });

    currentRecords = getParticipations().filter(function(record) {
      return record.PARTIDO_ID === matchId;
    });

    currentRecords.forEach(function(record) {
      if (!selected[record.ALUMNO_ID]) {
        errors.push('PARTICIPATION_UNSELECTED_PLAYER');
      } else {
        present[record.ALUMNO_ID] = true;
      }

      normalizeParticipation(record, record.PARTICIPACION_ID);

      if (record.ASISTIO && record.CALIFICACION === '') {
        errors.push('PARTICIPATION_RATING_PENDING');
      }
    });

    Object.keys(selected).forEach(function(studentId) {
      if (!present[studentId]) {
        errors.push('PARTICIPATION_MISSING_SELECTED_PLAYER');
      }
    });

    return {
      ready: errors.length === 0,
      errors: errors,
      alerts: redCardAlerts(currentRecords).concat(lowParticipationAlerts(matchId, currentRecords))
    };
  }

  return {
    createParticipation: createParticipation,
    getParticipations: getParticipations,
    updateParticipation: updateParticipation,
    validateMatchParticipationReadiness: validateMatchParticipationReadiness
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createParticipationService };
}
