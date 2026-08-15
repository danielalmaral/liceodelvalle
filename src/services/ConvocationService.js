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

  function previousSelectionCount(studentId, competition) {
    var historical = {};

    convocationRepository.getAll().forEach(function(convocation) {
      if (convocation.COMPETENCIA === competition && ['APROBADA', 'ENVIADA', 'CERRADA'].indexOf(convocation.ESTADO) !== -1) {
        var match = matchService.getMatchById(convocation.PARTIDO_ID);
        if (match && match.estado !== 'CANCELADO') {
          historical[convocation.CONVOCATORIA_ID] = true;
        }
      }
    });

    return detailRepository.getAll().filter(function(detail) {
      return historical[detail.CONVOCATORIA_ID] && detail.ALUMNO_ID === studentId && detail.SELECCIONADO_FINAL;
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

  function selectRecommended(details, snapshots, competition) {
    var eligible = details.filter(function(detail) { return detail.ELEGIBILITY_STATUS === 'ELIGIBLE'; });
    var needed = { PO: snapshots.minPo, DEF: snapshots.minDef, MED: snapshots.minMed, DEL: snapshots.minDel };
    var selected = [];

    eligible.sort(function(left, right) { return compareCandidates(competition, left, right); });

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

    eligible.filter(function(detail) { return detail.PRIORIDAD_ROTACION; }).forEach(function(candidate) {
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
      positionConflict: Object.keys(needed).some(function(position) { return needed[position] > 0; })
    };
  }

  function buildDetails(convocationId, match, competition) {
    var eligibilityByStudent = {};
    eligibilityService.evaluateMatch(match.partidoId).forEach(function(result) {
      eligibilityByStudent[result.studentId] = result;
    });

    return studentRepository.getAll().filter(function(student) {
      return student.COMPETENCIA_BASE === competition;
    }).map(function(student, index) {
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
        ORDEN_PRIORIDAD: index + 1
      };
    });
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
    var alerts = 0;

    if (selection.insufficient) {
      alerts += 1;
    }

    if (selection.positionConflict) {
      alerts += 1;
    }

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
      TOTAL_ALERTAS: alerts,
      OBSERVACIONES: selection.insufficient ? 'INSUFFICIENT_ELIGIBLE_PLAYERS' : (selection.positionConflict ? 'ROTATION_POSITION_CONFLICT' : '')
    };

    convocationRepository.insert(convocation);
    details.forEach(function(detail, index) {
      detail.ORDEN_PRIORIDAD = index + 1;
      detailRepository.insert(detail);
    });

    return {
      convocation: convocation,
      details: details
    };
  }

  function selectedDetails(convocationId) {
    return detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId && detail.SELECCIONADO_FINAL;
    });
  }

  function validateApproval(convocation, details, actor) {
    if (!actor) {
      throw utils.createDomainError('CONVOCATION_APPROVAL_ACTOR_REQUIRED', convocation.CONVOCATORIA_ID);
    }

    var match = matchService.getMatchById(convocation.PARTIDO_ID);

    if (!match || match.estado === 'CANCELADO') {
      throw utils.createDomainError('CONVOCATION_APPROVAL_CANCELLED_MATCH', convocation.CONVOCATORIA_ID);
    }

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
    var convocation = convocationRepository.getAll().filter(function(candidate) {
      return candidate.CONVOCATORIA_ID === convocationId;
    })[0];

    if (!convocation) {
      throw utils.createDomainError('CONVOCATION_NOT_FOUND', convocationId);
    }

    var details = detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId;
    });

    validateApproval(convocation, details, actor);

    var nextConvocation = {};
    Object.keys(convocation).forEach(function(key) {
      nextConvocation[key] = convocation[key];
    });
    nextConvocation.ESTADO = 'APROBADA';
    nextConvocation.APROBADA_EN = clock.now();
    nextConvocation.APROBADA_POR = actor;

    details.forEach(function(detail) {
      var rotation = rotationService.previewUpdate({
        studentId: detail.ALUMNO_ID,
        competition: detail.COMPETENCIA_SNAPSHOT,
        status: detail.ELEGIBILITY_STATUS
      }, detail.SELECCIONADO_FINAL);
      var nextDetail = {};
      Object.keys(detail).forEach(function(key) {
        nextDetail[key] = detail[key];
      });
      nextDetail.ROTACION_DESPUES = rotation.rotationAfter;
      detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, nextDetail);
    });

    return convocationRepository.updateById('CONVOCATORIA_ID', convocationId, nextConvocation);
  }

  return {
    approveConvocation: approveConvocation,
    generateConvocation: generateConvocation,
    validateApproval: validateApproval
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createConvocationService };
}
