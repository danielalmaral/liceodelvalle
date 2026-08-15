function createAttendanceMetricsService(dependencies) {
  var utils = dependencies.utils;
  var attendanceRepository = dependencies.attendanceRepository;
  var configService = dependencies.configService;
  var validateConfigPolicy = dependencies.validateAttendanceConfigPolicy || (typeof globalThis !== 'undefined' ? globalThis.validateAttendanceConfigPolicy : null);
  var validateSnapshot = dependencies.validateAttendanceSnapshot || (typeof globalThis !== 'undefined' ? globalThis.validateAttendanceSnapshot : null);

  function validateAttendanceConfigRelations() {
    if (typeof validateConfigPolicy !== 'function') {
      throw utils.createDomainError('ATTENDANCE_CONFIG_POLICY_REQUIRED', 'validateAttendanceConfigPolicy');
    }

    return validateConfigPolicy(configService, utils);
  }

  function getStudentMetrics(studentId) {
    var rows = attendanceRepository.getAll().filter(function(row) {
      return row.ALUMNO_ID === studentId;
    });

    rows.forEach(function(row) {
      if (typeof validateSnapshot !== 'function') {
        throw utils.createDomainError('ATTENDANCE_SNAPSHOT_VALIDATOR_REQUIRED', 'validateAttendanceSnapshot');
      }

      validateSnapshot(row, utils);
    });

    if (rows.length === 0) {
      return {
        studentId: studentId,
        finalizedSessions: 0,
        pendingAbsences: 0,
        attendanceCount: 0,
        lateCount: 0,
        justifiedAbsenceCount: 0,
        unjustifiedAbsenceCount: 0,
        injuryCount: 0,
        compliancePercentage: null,
        physicalPresencePercentage: null,
        status: 'NO_DATA'
      };
    }

    var finalized = rows.filter(function(row) {
      return ['A', 'R', 'FJ', 'FI', 'LES'].indexOf(row.ESTADO) !== -1;
    });
    var pending = rows.filter(function(row) { return row.ESTADO === 'F'; });
    var valueSum = finalized.reduce(function(sum, row) { return sum + Number(row.VALOR_APLICADO); }, 0);
    var maxSum = finalized.reduce(function(sum, row) { return sum + Number(row.VALOR_MAXIMO_APLICADO); }, 0);
    var physical = rows.filter(function(row) { return row.ESTADO === 'A' || row.ESTADO === 'R'; }).length;

    return {
      studentId: studentId,
      finalizedSessions: finalized.length,
      pendingAbsences: pending.length,
      attendanceCount: rows.filter(function(row) { return row.ESTADO === 'A'; }).length,
      lateCount: rows.filter(function(row) { return row.ESTADO === 'R'; }).length,
      justifiedAbsenceCount: rows.filter(function(row) { return row.ESTADO === 'FJ'; }).length,
      unjustifiedAbsenceCount: rows.filter(function(row) { return row.ESTADO === 'FI'; }).length,
      injuryCount: rows.filter(function(row) { return row.ESTADO === 'LES'; }).length,
      compliancePercentage: maxSum > 0 ? (valueSum / maxSum) * 100 : null,
      physicalPresencePercentage: rows.length > 0 ? (physical / rows.length) * 100 : null,
      status: pending.length > 0 ? 'PROVISIONAL' : 'FINAL'
    };
  }

  return {
    getStudentMetrics: getStudentMetrics,
    validateAttendanceConfigRelations: validateAttendanceConfigRelations
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAttendanceMetricsService };
}
