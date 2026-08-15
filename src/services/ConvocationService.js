function createConvocationService(dependencies) {
  var utils = dependencies.utils;
  var configService = dependencies.configService;
  var convocationRepository = dependencies.convocationRepository;
  var detailRepository = dependencies.detailRepository;
  var studentRepository = dependencies.studentRepository;
  var matchService = dependencies.matchService;
  var eligibilityService = dependencies.eligibilityService;
  var rotationService = dependencies.rotationService;
  var idGenerator = dependencies.idGenerator || {};
  var clock = dependencies.clock || { now: function() { return new Date(); } };
  var AUTHORITATIVE_STATES = ['APROBADA', 'ENVIADA', 'CERRADA'];
  var POSITIONS = ['PO', 'DEF', 'MED', 'DEL'];

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
      throw utils.createDomainError('CONVOCATION_DETAIL_BOOLEAN_INVALID', fieldName);
    }
  }

  function normalizeHistoryBoolean(value, fieldName) {
    try {
      return utils.normalizeStrictBoolean(value, fieldName);
    } catch (error) {
      throw utils.createDomainError('CONVOCATION_HISTORY_BOOLEAN_INVALID', fieldName);
    }
  }

  function normalizeOptionalText(value) {
    return utils.optionalText(value);
  }

  function normalizeRequiredText(value, code, detail) {
    var normalized = utils.optionalText(value);

    if (!normalized) {
      throw utils.createDomainError(code, detail);
    }

    return normalized;
  }

  function normalizePosition(value) {
    return utils.requireText(value, 'POSICION_ASIGNADA').toUpperCase();
  }

  function sameValue(left, right) {
    if (left === null || left === undefined || left === '') {
      return right === null || right === undefined || right === '';
    }

    if (right === null || right === undefined || right === '') {
      return false;
    }

    if (typeof left === 'number' || typeof right === 'number') {
      return Number(left) === Number(right);
    }

    return left === right;
  }

  function snapshotConfig(competition) {
    var total = configService.getInteger(competition === 'A' ? 'CONVOCADOS_A' : 'CONVOCADOS_B');
    var minPo = configService.getInteger('MIN_PORTEROS');
    var minDef = configService.getInteger('MIN_DEFENSAS');
    var minMed = configService.getInteger('MIN_MEDIOS');
    var minDel = configService.getInteger('MIN_DELANTEROS');

    if (total <= 0 || minPo + minDef + minMed + minDel > total) {
      throw utils.createDomainError('CONVOCATION_CONFIG_INVALID', competition);
    }

    return {
      total: total,
      minPo: minPo,
      minDef: minDef,
      minMed: minMed,
      minDel: minDel,
      maxSinConvocatoria: configService.getInteger('MAX_SIN_CONVOCATORIA')
    };
  }

  function levelRank(level) {
    return { A1: 4, A2: 3, B1: 2, B2: 1 }[level] || 0;
  }

  function isAuthoritative(convocation) {
    return AUTHORITATIVE_STATES.indexOf(convocation.ESTADO) !== -1;
  }

  function activeMatch(convocation) {
    var match = matchService.getMatchById(convocation.PARTIDO_ID);
    return match && match.estado !== 'CANCELADO';
  }

  function previousSelectionCount(studentId, competition) {
    var historical = {};

    convocationRepository.getAll().forEach(function(convocation) {
      if (convocation.COMPETENCIA === competition && isAuthoritative(convocation) && activeMatch(convocation)) {
        historical[convocation.CONVOCATORIA_ID] = true;
      }
    });

    return detailRepository.getAll().filter(function(detail) {
      return historical[detail.CONVOCATORIA_ID] && detail.ALUMNO_ID === studentId && normalizeHistoryBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL');
    }).length;
  }

  function compareCandidates(competition, left, right) {
    if (left.PRIORIDAD_ROTACION !== right.PRIORIDAD_ROTACION) {
      return left.PRIORIDAD_ROTACION ? -1 : 1;
    }

    if (competition === 'A') {
      if (levelRank(left.NIVEL_SNAPSHOT) !== levelRank(right.NIVEL_SNAPSHOT)) {
        return levelRank(right.NIVEL_SNAPSHOT) - levelRank(left.NIVEL_SNAPSHOT);
      }

      if (left.PUNTAJE_ASISTENCIA_SNAPSHOT !== null && right.PUNTAJE_ASISTENCIA_SNAPSHOT !== null && left.PUNTAJE_ASISTENCIA_SNAPSHOT !== right.PUNTAJE_ASISTENCIA_SNAPSHOT) {
        return right.PUNTAJE_ASISTENCIA_SNAPSHOT - left.PUNTAJE_ASISTENCIA_SNAPSHOT;
      }

      if (left.TOTAL_CONVOCATORIAS_PREVIAS !== right.TOTAL_CONVOCATORIAS_PREVIAS) {
        return left.TOTAL_CONVOCATORIAS_PREVIAS - right.TOTAL_CONVOCATORIAS_PREVIAS;
      }
    } else {
      if (left.TOTAL_CONVOCATORIAS_PREVIAS !== right.TOTAL_CONVOCATORIAS_PREVIAS) {
        return left.TOTAL_CONVOCATORIAS_PREVIAS - right.TOTAL_CONVOCATORIAS_PREVIAS;
      }

      if (left.PUNTAJE_ASISTENCIA_SNAPSHOT !== null && right.PUNTAJE_ASISTENCIA_SNAPSHOT !== null && left.PUNTAJE_ASISTENCIA_SNAPSHOT !== right.PUNTAJE_ASISTENCIA_SNAPSHOT) {
        return right.PUNTAJE_ASISTENCIA_SNAPSHOT - left.PUNTAJE_ASISTENCIA_SNAPSHOT;
      }

      if (levelRank(left.NIVEL_SNAPSHOT) !== levelRank(right.NIVEL_SNAPSHOT)) {
        return levelRank(right.NIVEL_SNAPSHOT) - levelRank(left.NIVEL_SNAPSHOT);
      }
    }

    return String(left.ALUMNO_ID).localeCompare(String(right.ALUMNO_ID));
  }

  function positionFor(candidate, needed) {
    if (needed[candidate.POSICION_PRINCIPAL_SNAPSHOT] > 0) {
      return candidate.POSICION_PRINCIPAL_SNAPSHOT;
    }

    if (candidate.POSICION_SECUNDARIA_SNAPSHOT && needed[candidate.POSICION_SECUNDARIA_SNAPSHOT] > 0) {
      return candidate.POSICION_SECUNDARIA_SNAPSHOT;
    }

    return candidate.POSICION_PRINCIPAL_SNAPSHOT;
  }

  function isAllowedPosition(detail, position) {
    return POSITIONS.indexOf(position) !== -1 && (position === detail.POSICION_PRINCIPAL_SNAPSHOT || position === detail.POSICION_SECUNDARIA_SNAPSHOT);
  }

  function rankedEligible(details, competition) {
    return details.filter(function(detail) {
      return detail.ELEGIBILITY_STATUS === 'ELIGIBLE';
    }).sort(function(left, right) {
      return compareCandidates(competition, left, right);
    });
  }

  function selectRecommended(details, snapshots, competition) {
    var eligible = rankedEligible(details, competition);
    var needed = { PO: snapshots.minPo, DEF: snapshots.minDef, MED: snapshots.minMed, DEL: snapshots.minDel };
    var selected = [];
    var priority = eligible.filter(function(detail) { return detail.PRIORIDAD_ROTACION; });

    eligible.forEach(function(detail, index) {
      detail.ORDEN_PRIORIDAD = index + 1;
    });

    function addCandidate(candidate, assignedPosition) {
      if (selected.indexOf(candidate) !== -1 || selected.length >= snapshots.total) {
        return;
      }

      candidate.RECOMENDADO_SISTEMA = true;
      candidate.SELECCIONADO_FINAL = true;
      candidate.POSICION_ASIGNADA = assignedPosition;
      selected.push(candidate);

      if (needed[assignedPosition] > 0) {
        needed[assignedPosition] -= 1;
      }
    }

    priority.forEach(function(candidate) {
      addCandidate(candidate, positionFor(candidate, needed));
    });

    ['PO', 'DEF', 'MED', 'DEL'].forEach(function(position) {
      eligible.forEach(function(candidate) {
        if (needed[position] > 0 && selected.indexOf(candidate) === -1 && (candidate.POSICION_PRINCIPAL_SNAPSHOT === position || candidate.POSICION_SECUNDARIA_SNAPSHOT === position)) {
          addCandidate(candidate, position);
        }
      });
    });

    eligible.forEach(function(candidate) {
      addCandidate(candidate, positionFor(candidate, needed));
    });

    return {
      selected: selected,
      insufficient: eligible.length < snapshots.total,
      positionConflict: Object.keys(needed).some(function(position) { return needed[position] > 0; }),
      priorityOverflow: priority.length > snapshots.total || priority.some(function(detail) { return !detail.SELECCIONADO_FINAL; })
    };
  }

  function buildDetails(convocationId, match, competition) {
    var eligibilityByStudent = {};
    eligibilityService.evaluateMatch(match.partidoId).forEach(function(result) {
      eligibilityByStudent[result.studentId] = result;
    });

    return studentRepository.getAll().filter(function(student) {
      return student.COMPETENCIA_BASE === competition;
    }).map(function(student) {
      var eligibility = eligibilityByStudent[student.ALUMNO_ID];
      var rotation = rotationService.previewUpdate(eligibility, false);

      return {
        DETALLE_ID: idGenerator.detailId ? idGenerator.detailId(student.ALUMNO_ID) : 'DET-' + convocationId + '-' + student.ALUMNO_ID,
        CONVOCATORIA_ID: convocationId,
        ALUMNO_ID: student.ALUMNO_ID,
        ELEGIBILITY_STATUS: eligibility.status,
        MOTIVO_NO_ELEGIBLE: eligibility.reason,
        FI_ORIGEN_ID: eligibility.fiSourceAttendanceId,
        COMPETENCIA_SNAPSHOT: competition,
        NIVEL_SNAPSHOT: student.NIVEL,
        POSICION_PRINCIPAL_SNAPSHOT: student.POSICION_PRINCIPAL,
        POSICION_SECUNDARIA_SNAPSHOT: student.POSICION_SECUNDARIA || '',
        POSICION_ASIGNADA: '',
        PUNTAJE_ASISTENCIA_SNAPSHOT: eligibility.compliancePercentage,
        PRESENCIA_REAL_SNAPSHOT: eligibility.physicalPresencePercentage,
        ROTACION_ANTES: rotation.rotationBefore,
        PRIORIDAD_ROTACION: rotation.priorityRotation,
        TOTAL_CONVOCATORIAS_PREVIAS: previousSelectionCount(student.ALUMNO_ID, competition),
        RECOMENDADO_SISTEMA: false,
        SELECCIONADO_FINAL: false,
        CAMBIO_MANUAL: false,
        MOTIVO_CAMBIO: '',
        ROTATION_EXCEPTION: false,
        ROTACION_DESPUES: rotation.rotationBefore,
        ORDEN_PRIORIDAD: ''
      };
    });
  }

  function assertUniqueBy(records, selector, code) {
    var seen = {};
    records.forEach(function(record) {
      var key = selector(record);
      if (!key || seen[key]) {
        throw utils.createDomainError(code, key || '');
      }
      seen[key] = true;
    });
  }

  function assertGeneratedIntegrity(convocationId, details) {
    convocationRepository.getAll().forEach(function(convocation) {
      if (convocation.CONVOCATORIA_ID === convocationId) {
        throw utils.createDomainError('CONVOCATION_DUPLICATE_ID', convocationId);
      }
    });

    assertUniqueBy(details, function(detail) { return detail.DETALLE_ID; }, 'CONVOCATION_DETAIL_DUPLICATE_ID');
    assertUniqueBy(details, function(detail) { return detail.ALUMNO_ID; }, 'CONVOCATION_DETAIL_DUPLICATE_STUDENT');

    detailRepository.getAll().forEach(function(existingDetail) {
      details.forEach(function(detail) {
        if (existingDetail.DETALLE_ID === detail.DETALLE_ID) {
          throw utils.createDomainError('CONVOCATION_DETAIL_ID_COLLISION', detail.DETALLE_ID);
        }
      });
    });
  }

  function observations(selection) {
    var values = [];

    if (selection.insufficient) {
      values.push('INSUFFICIENT_ELIGIBLE_PLAYERS');
    }

    if (selection.positionConflict || selection.priorityOverflow) {
      values.push('ROTATION_POSITION_CONFLICT');
    }

    return values.join('|');
  }

  function rebuildCanonicalRecommendation(convocation, details) {
    var snapshots = {
      total: Number(convocation.TOTAL_OBJETIVO),
      minPo: Number(convocation.MIN_PORTEROS_SNAPSHOT),
      minDef: Number(convocation.MIN_DEFENSAS_SNAPSHOT),
      minMed: Number(convocation.MIN_MEDIOS_SNAPSHOT),
      minDel: Number(convocation.MIN_DELANTEROS_SNAPSHOT)
    };
    var rebuilt = details.map(function(detail) {
      var nextDetail = copyRecord(detail);
      nextDetail.RECOMENDADO_SISTEMA = false;
      nextDetail.SELECCIONADO_FINAL = false;
      nextDetail.POSICION_ASIGNADA = '';
      nextDetail.CAMBIO_MANUAL = false;
      nextDetail.MOTIVO_CAMBIO = '';
      nextDetail.ROTATION_EXCEPTION = false;
      nextDetail.ORDEN_PRIORIDAD = '';
      return nextDetail;
    });
    var byStudent = {};

    selectRecommended(rebuilt, snapshots, convocation.COMPETENCIA);

    rebuilt.forEach(function(detail) {
      byStudent[detail.ALUMNO_ID] = {
        ordenPrioridad: detail.ORDEN_PRIORIDAD,
        posicionAsignada: detail.POSICION_ASIGNADA,
        recomendadoSistema: detail.RECOMENDADO_SISTEMA,
        seleccionadoFinal: detail.SELECCIONADO_FINAL
      };
    });

    return byStudent;
  }

  function generateConvocation(matchId, actor) {
    var match = matchService.getMatchById(matchId);

    if (!match) {
      throw utils.createDomainError('MATCH_NOT_FOUND', matchId);
    }

    var snapshots = snapshotConfig(match.competencia);
    var convocationId = idGenerator.convocationId ? idGenerator.convocationId() : '';

    if (!convocationId) {
      throw utils.createDomainError('CONVOCATION_ID_REQUIRED', 'CONVOCATORIA_ID');
    }

    var details = buildDetails(convocationId, match, match.competencia);
    var selection = selectRecommended(details, snapshots, match.competencia);
    var alertText = observations(selection);
    assertGeneratedIntegrity(convocationId, details);

    var convocation = {
      CONVOCATORIA_ID: convocationId,
      PARTIDO_ID: match.partidoId,
      COMPETENCIA: match.competencia,
      TOTAL_OBJETIVO: snapshots.total,
      MIN_PORTEROS_SNAPSHOT: snapshots.minPo,
      MIN_DEFENSAS_SNAPSHOT: snapshots.minDef,
      MIN_MEDIOS_SNAPSHOT: snapshots.minMed,
      MIN_DELANTEROS_SNAPSHOT: snapshots.minDel,
      MAX_SIN_CONVOCATORIA_SNAPSHOT: snapshots.maxSinConvocatoria,
      ESTADO: 'PROPUESTA',
      GENERADA_EN: clock.now(),
      GENERADA_POR: actor || '',
      APROBADA_EN: '',
      APROBADA_POR: '',
      ENVIADA_EN: '',
      TOTAL_SELECCIONADOS: selection.selected.length,
      TOTAL_ALERTAS: alertText ? alertText.split('|').length : 0,
      OBSERVACIONES: alertText
    };

    convocationRepository.insert(convocation);
    details.forEach(function(detail) {
      detailRepository.insert(detail);
    });

    return {
      convocation: copyRecord(convocation),
      details: details.map(copyRecord)
    };
  }

  function getConvocation(convocationId) {
    return convocationRepository.getAll().filter(function(candidate) {
      return candidate.CONVOCATORIA_ID === convocationId;
    })[0] || null;
  }

  function getDetails(convocationId) {
    return detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId;
    });
  }

  function assertProposal(convocation) {
    if (convocation.ESTADO !== 'PROPUESTA') {
      throw utils.createDomainError('CONVOCATION_INVALID_STATE_TRANSITION', convocation.CONVOCATORIA_ID);
    }
  }

  function updateSelectionTotal(convocation) {
    var nextConvocation = copyRecord(convocation);
    nextConvocation.TOTAL_SELECCIONADOS = getDetails(convocation.CONVOCATORIA_ID).filter(function(detail) {
      return detail.SELECCIONADO_FINAL;
    }).length;
    convocationRepository.updateById('CONVOCATORIA_ID', convocation.CONVOCATORIA_ID, nextConvocation);
    return nextConvocation;
  }

  function setFinalSelection(convocationId, alumnoId, selected, reason) {
    var convocation = getConvocation(convocationId);
    var detail = null;
    var nextDetail;

    if (!convocation) {
      throw utils.createDomainError('CONVOCATION_NOT_FOUND', convocationId);
    }

    assertProposal(convocation);
    detail = getDetails(convocationId).filter(function(candidate) {
      return candidate.ALUMNO_ID === alumnoId;
    })[0];

    if (!detail) {
      throw utils.createDomainError('CONVOCATION_DETAIL_NOT_FOUND', alumnoId);
    }

    selected = normalizeBoolean(selected, 'SELECCIONADO_FINAL');
    reason = normalizeOptionalText(reason);

    if (selected && detail.ELEGIBILITY_STATUS === 'INELIGIBLE') {
      throw utils.createDomainError('CONVOCATION_MANUAL_INELIGIBLE', alumnoId);
    }

    if (selected && detail.ELEGIBILITY_STATUS === 'PENDING') {
      throw utils.createDomainError('CONVOCATION_MANUAL_PENDING', alumnoId);
    }

    if (selected !== normalizeBoolean(detail.RECOMENDADO_SISTEMA, 'RECOMENDADO_SISTEMA') && !reason) {
      throw utils.createDomainError('CONVOCATION_MANUAL_REASON_REQUIRED', alumnoId);
    }

    if (!selected && normalizeBoolean(detail.PRIORIDAD_ROTACION, 'PRIORIDAD_ROTACION') && !reason) {
      throw utils.createDomainError('ROTATION_EXCEPTION_REASON_REQUIRED', alumnoId);
    }

    nextDetail = copyRecord(detail);
    nextDetail.SELECCIONADO_FINAL = selected;
    nextDetail.CAMBIO_MANUAL = selected !== normalizeBoolean(detail.RECOMENDADO_SISTEMA, 'RECOMENDADO_SISTEMA');
    nextDetail.MOTIVO_CAMBIO = reason || nextDetail.MOTIVO_CAMBIO || '';
    nextDetail.ROTATION_EXCEPTION = !selected && normalizeBoolean(detail.PRIORIDAD_ROTACION, 'PRIORIDAD_ROTACION');

    if (selected && !nextDetail.POSICION_ASIGNADA) {
      nextDetail.POSICION_ASIGNADA = nextDetail.POSICION_PRINCIPAL_SNAPSHOT;
    }

    if (!selected) {
      nextDetail.POSICION_ASIGNADA = '';
    }

    detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, nextDetail);
    updateSelectionTotal(convocation);
    return copyRecord(nextDetail);
  }

  function assignPlayerPosition(convocationId, alumnoId, position, reason) {
    var convocation = getConvocation(convocationId);
    var detail;
    var nextDetail;

    if (!convocation) {
      throw utils.createDomainError('CONVOCATION_NOT_FOUND', convocationId);
    }

    assertProposal(convocation);
    detail = getDetails(convocationId).filter(function(candidate) {
      return candidate.ALUMNO_ID === alumnoId;
    })[0];

    if (!detail) {
      throw utils.createDomainError('CONVOCATION_DETAIL_NOT_FOUND', alumnoId);
    }

    if (!detail.SELECCIONADO_FINAL) {
      throw utils.createDomainError('CONVOCATION_POSITION_UNSELECTED', alumnoId);
    }

    position = normalizePosition(position);
    reason = normalizeOptionalText(reason);

    if (!isAllowedPosition(detail, position)) {
      throw utils.createDomainError('CONVOCATION_ASSIGNED_POSITION_INVALID', alumnoId);
    }

    if (position !== detail.POSICION_ASIGNADA && !reason) {
      throw utils.createDomainError('CONVOCATION_MANUAL_REASON_REQUIRED', alumnoId);
    }

    nextDetail = copyRecord(detail);
    nextDetail.POSICION_ASIGNADA = position;
    nextDetail.CAMBIO_MANUAL = nextDetail.CAMBIO_MANUAL || position !== detail.POSICION_ASIGNADA;
    nextDetail.MOTIVO_CAMBIO = reason || nextDetail.MOTIVO_CAMBIO || '';
    detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, nextDetail);
    return copyRecord(nextDetail);
  }

  function canonicalDetails(details) {
    return details.map(function(detail) {
      var nextDetail = copyRecord(detail);
      nextDetail.PRIORIDAD_ROTACION = normalizeBoolean(detail.PRIORIDAD_ROTACION, 'PRIORIDAD_ROTACION');
      nextDetail.RECOMENDADO_SISTEMA = normalizeBoolean(detail.RECOMENDADO_SISTEMA, 'RECOMENDADO_SISTEMA');
      nextDetail.SELECCIONADO_FINAL = normalizeBoolean(detail.SELECCIONADO_FINAL, 'SELECCIONADO_FINAL');
      nextDetail.CAMBIO_MANUAL = normalizeBoolean(detail.CAMBIO_MANUAL, 'CAMBIO_MANUAL');
      nextDetail.ROTATION_EXCEPTION = normalizeBoolean(detail.ROTATION_EXCEPTION, 'ROTATION_EXCEPTION');
      nextDetail.MOTIVO_CAMBIO = normalizeOptionalText(detail.MOTIVO_CAMBIO);
      return nextDetail;
    });
  }

  function assertCurrentPoolSet(convocation, details) {
    var currentPool = {};
    var detailPool = {};
    var currentCount = 0;
    var detailCount = 0;

    studentRepository.getAll().forEach(function(student) {
      if (student.COMPETENCIA_BASE === convocation.COMPETENCIA) {
        currentPool[student.ALUMNO_ID] = true;
        currentCount += 1;
      }
    });

    details.forEach(function(detail) {
      detailPool[detail.ALUMNO_ID] = true;
      detailCount += 1;
    });

    if (currentCount !== detailCount) {
      throw utils.createDomainError('CONVOCATION_DETAIL_SET_MISMATCH', convocation.CONVOCATORIA_ID);
    }

    Object.keys(currentPool).forEach(function(studentId) {
      if (!detailPool[studentId]) {
        throw utils.createDomainError('CONVOCATION_DETAIL_SET_MISMATCH', studentId);
      }
    });

    Object.keys(detailPool).forEach(function(studentId) {
      if (!currentPool[studentId]) {
        throw utils.createDomainError('CONVOCATION_DETAIL_SET_MISMATCH', studentId);
      }
    });
  }

  function assertDetailIntegrity(convocation, details) {
    assertUniqueBy(details, function(detail) { return detail.DETALLE_ID; }, 'CONVOCATION_DETAIL_DUPLICATE_ID');
    assertUniqueBy(details, function(detail) { return detail.ALUMNO_ID; }, 'CONVOCATION_DETAIL_DUPLICATE_STUDENT');
    assertCurrentPoolSet(convocation, details);

    details.forEach(function(detail) {
      utils.requireText(detail.DETALLE_ID, 'DETALLE_ID');
      utils.requireText(detail.ALUMNO_ID, 'ALUMNO_ID');

      if (detail.CONVOCATORIA_ID !== convocation.CONVOCATORIA_ID) {
        throw utils.createDomainError('CONVOCATION_DETAIL_FOREIGN_KEY', detail.DETALLE_ID);
      }

      if (detail.COMPETENCIA_SNAPSHOT !== convocation.COMPETENCIA) {
        throw utils.createDomainError('CONVOCATION_DETAIL_COMPETITION', detail.DETALLE_ID);
      }

      if (detail.SELECCIONADO_FINAL) {
        if (POSITIONS.indexOf(detail.POSICION_ASIGNADA) === -1) {
          throw utils.createDomainError('CONVOCATION_ASSIGNED_POSITION_ENUM', detail.ALUMNO_ID);
        }

        if (!isAllowedPosition(detail, detail.POSICION_ASIGNADA)) {
          throw utils.createDomainError('CONVOCATION_ASSIGNED_POSITION_INVALID', detail.ALUMNO_ID);
        }
      }
    });
  }

  function hasReason(detail) {
    return utils.optionalText(detail.MOTIVO_CAMBIO) !== '';
  }

  function assertCanonicalRecommendation(convocation, details) {
    var canonical = rebuildCanonicalRecommendation(convocation, details);

    details.forEach(function(detail) {
      var expected = canonical[detail.ALUMNO_ID];
      var isEligible = detail.ELEGIBILITY_STATUS === 'ELIGIBLE';
      var selectionChanged;
      var positionChanged;

      if (!expected) {
        throw utils.createDomainError('CONVOCATION_STALE_PROPOSAL', detail.ALUMNO_ID);
      }

      if (detail.RECOMENDADO_SISTEMA !== expected.recomendadoSistema) {
        throw utils.createDomainError('CONVOCATION_SYSTEM_RECOMMENDATION_CORRUPTED', detail.ALUMNO_ID);
      }

      if (isEligible && Number(detail.ORDEN_PRIORIDAD) !== Number(expected.ordenPrioridad)) {
        throw utils.createDomainError('CONVOCATION_PRIORITY_ORDER_CORRUPTED', detail.ALUMNO_ID);
      }

      if (!isEligible && detail.ORDEN_PRIORIDAD !== '' && detail.ORDEN_PRIORIDAD !== null && detail.ORDEN_PRIORIDAD !== undefined) {
        throw utils.createDomainError('CONVOCATION_PRIORITY_ORDER_CORRUPTED', detail.ALUMNO_ID);
      }

      selectionChanged = detail.SELECCIONADO_FINAL !== expected.seleccionadoFinal;
      positionChanged = expected.seleccionadoFinal && detail.SELECCIONADO_FINAL && detail.POSICION_ASIGNADA !== expected.posicionAsignada;

      if ((selectionChanged || positionChanged) && (!detail.CAMBIO_MANUAL || !hasReason(detail))) {
        throw utils.createDomainError('CONVOCATION_MANUAL_CHANGE_NOT_DECLARED', detail.ALUMNO_ID);
      }
    });
  }

  function assertCurrentAuthority(convocation, details) {
    var currentByStudent = {};
    var studentById = {};
    var match = matchService.getMatchById(convocation.PARTIDO_ID);

    eligibilityService.evaluateMatch(convocation.PARTIDO_ID).forEach(function(eligibility) {
      currentByStudent[eligibility.studentId] = eligibility;
    });

    studentRepository.getAll().forEach(function(student) {
      studentById[student.ALUMNO_ID] = student;
    });

    details.forEach(function(detail) {
      var current = currentByStudent[detail.ALUMNO_ID];
      var student = studentById[detail.ALUMNO_ID];
      var rotation;

      if (!current || !student) {
        throw utils.createDomainError('CONVOCATION_STALE_PROPOSAL', detail.ALUMNO_ID);
      }

      if (current.status !== detail.ELEGIBILITY_STATUS || current.reason !== detail.MOTIVO_NO_ELEGIBLE || current.fiSourceAttendanceId !== detail.FI_ORIGEN_ID) {
        throw utils.createDomainError('CONVOCATION_STALE_PROPOSAL', detail.ALUMNO_ID);
      }

      rotation = rotationService.previewUpdate(current, false);

      if (rotation.rotationBefore !== Number(detail.ROTACION_ANTES) || rotation.priorityRotation !== Boolean(detail.PRIORIDAD_ROTACION)) {
        throw utils.createDomainError('CONVOCATION_STALE_PROPOSAL', detail.ALUMNO_ID);
      }

      if (
        student.NIVEL !== detail.NIVEL_SNAPSHOT ||
        student.POSICION_PRINCIPAL !== detail.POSICION_PRINCIPAL_SNAPSHOT ||
        (student.POSICION_SECUNDARIA || '') !== detail.POSICION_SECUNDARIA_SNAPSHOT ||
        !sameValue(current.compliancePercentage, detail.PUNTAJE_ASISTENCIA_SNAPSHOT) ||
        !sameValue(current.physicalPresencePercentage, detail.PRESENCIA_REAL_SNAPSHOT) ||
        previousSelectionCount(detail.ALUMNO_ID, convocation.COMPETENCIA) !== Number(detail.TOTAL_CONVOCATORIAS_PREVIAS)
      ) {
        throw utils.createDomainError('CONVOCATION_STALE_PROPOSAL', detail.ALUMNO_ID);
      }
    });

    if (!match || match.estado === 'CANCELADO') {
      throw utils.createDomainError('CONVOCATION_APPROVAL_CANCELLED_MATCH', convocation.CONVOCATORIA_ID);
    }
  }

  function assertNoPreviousAuthoritativeForMatch(convocation) {
    convocationRepository.getAll().forEach(function(candidate) {
      if (candidate.CONVOCATORIA_ID !== convocation.CONVOCATORIA_ID && candidate.PARTIDO_ID === convocation.PARTIDO_ID && isAuthoritative(candidate) && activeMatch(candidate)) {
        throw utils.createDomainError('CONVOCATION_MATCH_ALREADY_APPROVED', convocation.PARTIDO_ID);
      }
    });
  }

  function assertFiNotConsumedTwice(convocation, details) {
    var fiIds = {};
    details.forEach(function(detail) {
      if (detail.ELEGIBILITY_STATUS === 'INELIGIBLE' && detail.MOTIVO_NO_ELEGIBLE === 'FI_BLOCK' && detail.FI_ORIGEN_ID) {
        fiIds[detail.FI_ORIGEN_ID] = true;
      }
    });

    detailRepository.getAll().forEach(function(detail) {
      if (!fiIds[detail.FI_ORIGEN_ID] || detail.CONVOCATORIA_ID === convocation.CONVOCATORIA_ID) {
        return;
      }

      convocationRepository.getAll().forEach(function(candidate) {
        if (candidate.CONVOCATORIA_ID === detail.CONVOCATORIA_ID && isAuthoritative(candidate) && activeMatch(candidate)) {
          throw utils.createDomainError('CONVOCATION_STALE_PROPOSAL', detail.FI_ORIGEN_ID);
        }
      });
    });
  }

  function validateApproval(convocation, details, actor) {
    actor = normalizeRequiredText(actor, 'CONVOCATION_APPROVAL_ACTOR_REQUIRED', convocation.CONVOCATORIA_ID);
    details = canonicalDetails(details);

    assertProposal(convocation);
    assertNoPreviousAuthoritativeForMatch(convocation);
    assertDetailIntegrity(convocation, details);
    assertCurrentAuthority(convocation, details);
    assertCanonicalRecommendation(convocation, details);
    assertFiNotConsumedTwice(convocation, details);

    var selected = details.filter(function(detail) { return detail.SELECCIONADO_FINAL; });

    if (selected.length !== Number(convocation.TOTAL_OBJETIVO)) {
      throw utils.createDomainError('CONVOCATION_APPROVAL_EXACT_TOTAL', convocation.CONVOCATORIA_ID);
    }

    selected.forEach(function(detail) {
      if (detail.ELEGIBILITY_STATUS === 'INELIGIBLE') {
        throw utils.createDomainError('CONVOCATION_APPROVAL_INELIGIBLE', detail.ALUMNO_ID);
      }

      if (detail.ELEGIBILITY_STATUS === 'PENDING') {
        throw utils.createDomainError('CONVOCATION_APPROVAL_PENDING', detail.ALUMNO_ID);
      }

      if (detail.CAMBIO_MANUAL && !detail.MOTIVO_CAMBIO) {
        throw utils.createDomainError('CONVOCATION_MANUAL_REASON_REQUIRED', detail.ALUMNO_ID);
      }
    });

    details.forEach(function(detail) {
      rotationService.validatePriorityException(detail);
    });

    var counts = { PO: 0, DEF: 0, MED: 0, DEL: 0 };
    selected.forEach(function(detail) {
      counts[detail.POSICION_ASIGNADA] += 1;
    });

    if (counts.PO < Number(convocation.MIN_PORTEROS_SNAPSHOT) || counts.DEF < Number(convocation.MIN_DEFENSAS_SNAPSHOT) || counts.MED < Number(convocation.MIN_MEDIOS_SNAPSHOT) || counts.DEL < Number(convocation.MIN_DELANTEROS_SNAPSHOT)) {
      throw utils.createDomainError('CONVOCATION_APPROVAL_POSITION', convocation.CONVOCATORIA_ID);
    }
  }

  function approveConvocation(convocationId, actor) {
    var convocation = getConvocation(convocationId);
    var details = canonicalDetails(getDetails(convocationId));

    if (!convocation) {
      throw utils.createDomainError('CONVOCATION_NOT_FOUND', convocationId);
    }

    validateApproval(convocation, details, actor);

    details.forEach(function(detail) {
      var rotation = rotationService.previewUpdate({
        studentId: detail.ALUMNO_ID,
        competition: detail.COMPETENCIA_SNAPSHOT,
        status: detail.ELEGIBILITY_STATUS
      }, detail.SELECCIONADO_FINAL);
      var nextDetail = copyRecord(detail);
      nextDetail.ROTACION_DESPUES = rotation.rotationAfter;
      detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, nextDetail);
    });

    var nextConvocation = copyRecord(convocation);
    nextConvocation.ESTADO = 'APROBADA';
    nextConvocation.APROBADA_EN = clock.now();
    nextConvocation.APROBADA_POR = actor;
    nextConvocation.TOTAL_SELECCIONADOS = details.filter(function(detail) { return detail.SELECCIONADO_FINAL; }).length;
    nextConvocation.APROBADA_POR = normalizeRequiredText(actor, 'CONVOCATION_APPROVAL_ACTOR_REQUIRED', convocation.CONVOCATORIA_ID);
    return convocationRepository.updateById('CONVOCATORIA_ID', convocationId, nextConvocation);
  }

  return {
    approveConvocation: approveConvocation,
    assignPlayerPosition: assignPlayerPosition,
    generateConvocation: generateConvocation,
    setFinalSelection: setFinalSelection,
    validateApproval: validateApproval
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createConvocationService };
}
