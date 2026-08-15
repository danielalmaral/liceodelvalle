function createEligibilityService(dependencies) {
  var utils = dependencies.utils;
  var studentRepository = dependencies.studentRepository;
  var attendanceRepository = dependencies.attendanceRepository;
  var convocationRepository = dependencies.convocationRepository;
  var detailRepository = dependencies.detailRepository;
  var matchService = dependencies.matchService;
  var metricsService = dependencies.metricsService;
  var clock = dependencies.clock || { now: function() { return new Date(); } };

  function approvedConvocationIdsByActiveMatch() {
    var ids = {};
    var convocations = convocationRepository ? convocationRepository.getAll() : [];

    convocations.forEach(function(convocation) {
      if (['APROBADA', 'ENVIADA', 'CERRADA'].indexOf(convocation.ESTADO) === -1) {
        return;
      }

      var match = matchService.getMatchById(convocation.PARTIDO_ID);

      if (match && match.estado !== 'CANCELADO') {
        ids[convocation.CONVOCATORIA_ID] = true;
      }
    });

    return ids;
  }

  function consumedFiIds() {
    var consumed = {};
    var approvedIds = approvedConvocationIdsByActiveMatch();
    var details = detailRepository ? detailRepository.getAll() : [];

    details.forEach(function(detail) {
      if (
        approvedIds[detail.CONVOCATORIA_ID] &&
        detail.ELEGIBILITY_STATUS === 'INELIGIBLE' &&
        detail.MOTIVO_NO_ELEGIBLE === 'FI_BLOCK' &&
        detail.FI_ORIGEN_ID
      ) {
        consumed[detail.FI_ORIGEN_ID] = true;
      }
    });

    return consumed;
  }

  function outstandingFiForStudent(studentId) {
    var consumed = consumedFiIds();
    var fis = attendanceRepository.getAll().filter(function(attendance) {
      return attendance.ALUMNO_ID === studentId && attendance.ESTADO === 'FI' && !consumed[attendance.ASISTENCIA_ID];
    });

    fis.sort(function(left, right) {
      var leftDate = new Date(left.MODIFICADO_EN || left.REGISTRADO_EN || 0).getTime();
      var rightDate = new Date(right.MODIFICADO_EN || right.REGISTRADO_EN || 0).getTime();

      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      return String(left.ASISTENCIA_ID).localeCompare(String(right.ASISTENCIA_ID));
    });

    return fis[0] || null;
  }

  function hasPendingAbsence(studentId) {
    return attendanceRepository.getAll().some(function(attendance) {
      return attendance.ALUMNO_ID === studentId && attendance.ESTADO === 'F';
    });
  }

  function evaluateStudentForMatch(student, match) {
    var metrics = metricsService.getStudentMetrics(student.ALUMNO_ID);
    var status = 'ELIGIBLE';
    var reason = '';
    var fi = null;

    if (student.COMPETENCIA_BASE !== match.competencia) {
      status = 'INELIGIBLE';
      reason = 'OUT_OF_POOL';
    } else if (!utils.normalizeStrictBoolean(student.ACTIVO, 'ACTIVO')) {
      status = 'INELIGIBLE';
      reason = 'STUDENT_INACTIVE';
    } else if (student.ESTADO_DEPORTIVO === 'LESIONADO') {
      status = 'INELIGIBLE';
      reason = 'INJURED';
    } else if (student.ESTADO_DEPORTIVO === 'SUSPENDIDO') {
      status = 'INELIGIBLE';
      reason = 'SUSPENDED';
    } else if (hasPendingAbsence(student.ALUMNO_ID)) {
      status = 'PENDING';
      reason = 'ABSENCE_PENDING';
    } else {
      fi = outstandingFiForStudent(student.ALUMNO_ID);

      if (fi) {
        status = 'INELIGIBLE';
        reason = 'FI_BLOCK';
      }
    }

    return {
      studentId: student.ALUMNO_ID,
      matchId: match.partidoId,
      competition: match.competencia,
      status: status,
      reason: reason,
      fiSourceAttendanceId: fi ? fi.ASISTENCIA_ID : '',
      compliancePercentage: metrics.compliancePercentage,
      physicalPresencePercentage: metrics.physicalPresencePercentage,
      attendanceMetricsStatus: metrics.status,
      evaluatedAt: clock.now()
    };
  }

  function evaluateMatch(matchId) {
    var match = matchService.getMatchById(matchId);

    if (!match) {
      throw utils.createDomainError('MATCH_NOT_FOUND', matchId);
    }

    return studentRepository.getAll()
      .filter(function(student) { return student.COMPETENCIA_BASE === match.competencia; })
      .map(function(student) { return evaluateStudentForMatch(student, match); });
  }

  return {
    evaluateMatch: evaluateMatch,
    evaluateStudentForMatch: evaluateStudentForMatch,
    outstandingFiForStudent: outstandingFiForStudent
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createEligibilityService };
}
