function createRotationService(dependencies) {
  var utils = dependencies.utils;
  var configService = dependencies.configService;
  var convocationRepository = dependencies.convocationRepository;
  var detailRepository = dependencies.detailRepository;
  var matchService = dependencies.matchService;

  function isHistoricalConvocation(convocation) {
    if (['APROBADA', 'ENVIADA', 'CERRADA'].indexOf(convocation.ESTADO) === -1) {
      return false;
    }

    var match = matchService.getMatchById(convocation.PARTIDO_ID);
    return !!match && match.estado !== 'CANCELADO';
  }

  function historicalConvocations(competition) {
    return convocationRepository.getAll().filter(function(convocation) {
      return convocation.COMPETENCIA === competition && isHistoricalConvocation(convocation);
    }).sort(function(left, right) {
      var leftMatch = matchService.getMatchById(left.PARTIDO_ID);
      var rightMatch = matchService.getMatchById(right.PARTIDO_ID);
      var leftDate = leftMatch && leftMatch.fecha ? leftMatch.fecha.getTime() : 0;
      var rightDate = rightMatch && rightMatch.fecha ? rightMatch.fecha.getTime() : 0;

      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      if ((leftMatch.horaPartido || '') !== (rightMatch.horaPartido || '')) {
        return String(leftMatch.horaPartido || '').localeCompare(String(rightMatch.horaPartido || ''));
      }

      return String(left.PARTIDO_ID).localeCompare(String(right.PARTIDO_ID));
    });
  }

  function getRotationBefore(studentId, competition) {
    var debt = 0;
    var details = detailRepository.getAll();

    historicalConvocations(competition).forEach(function(convocation) {
      details.filter(function(detail) {
        return detail.CONVOCATORIA_ID === convocation.CONVOCATORIA_ID && detail.ALUMNO_ID === studentId && detail.COMPETENCIA_SNAPSHOT === competition;
      }).forEach(function(detail) {
        if (detail.ELEGIBILITY_STATUS === 'ELIGIBLE') {
          debt = detail.SELECCIONADO_FINAL ? 0 : debt + 1;
        }
      });
    });

    return debt;
  }

  function isPriority(rotationBefore) {
    if (!configService.getBoolean('ROTACION_OBLIGATORIA')) {
      return false;
    }

    return rotationBefore >= configService.getInteger('MAX_SIN_CONVOCATORIA');
  }

  function previewUpdate(eligibility, selectedFinal) {
    var before = getRotationBefore(eligibility.studentId, eligibility.competition);
    var after = before;

    if (eligibility.status === 'ELIGIBLE') {
      after = selectedFinal ? 0 : before + 1;
    }

    return {
      studentId: eligibility.studentId,
      competition: eligibility.competition,
      rotationBefore: before,
      priorityRotation: eligibility.status === 'ELIGIBLE' ? isPriority(before) : false,
      rotationAfter: after
    };
  }

  function validatePriorityException(detail) {
    if (detail.PRIORIDAD_ROTACION && !detail.SELECCIONADO_FINAL) {
      if (!detail.ROTATION_EXCEPTION || !detail.MOTIVO_CAMBIO) {
        throw utils.createDomainError('ROTATION_EXCEPTION_REASON_REQUIRED', detail.ALUMNO_ID);
      }
    }

    return true;
  }

  return {
    getRotationBefore: getRotationBefore,
    isPriority: isPriority,
    previewUpdate: previewUpdate,
    validatePriorityException: validatePriorityException
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createRotationService };
}
