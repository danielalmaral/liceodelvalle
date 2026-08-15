function createAttendanceMetricsService(dependencies) {
  var utils = dependencies.utils;
  var attendanceRepository = dependencies.attendanceRepository;
  var configService = dependencies.configService;

  function validateAttendanceConfigRelations() {
    var asistencia = configService.getDecimal('ASISTENCIA_VALOR');
    var retardo = configService.getDecimal('RETARDO_VALOR');
    var faltaInjustificada = configService.getDecimal('FALTA_INJUSTIFICADA_VALOR');
    var faltaJustificada = configService.getDecimal('FALTA_JUSTIFICADA_VALOR');
    var lesion = configService.getDecimal('LESION_VALOR');

    if (!(asistencia > 0)) {
      throw utils.createDomainError('ATTENDANCE_CONFIG_RELATION_INVALID', 'ASISTENCIA_VALOR');
    }

    if (!(retardo < asistencia)) {
      throw utils.createDomainError('ATTENDANCE_CONFIG_RELATION_INVALID', 'RETARDO_VALOR');
    }

    if (!(faltaInjustificada < retardo)) {
      throw utils.createDomainError('ATTENDANCE_CONFIG_RELATION_INVALID', 'FALTA_INJUSTIFICADA_VALOR');
    }

    if (faltaJustificada !== asistencia) {
      throw utils.createDomainError('ATTENDANCE_CONFIG_RELATION_INVALID', 'FALTA_JUSTIFICADA_VALOR');
    }

    if (lesion !== asistencia) {
      throw utils.createDomainError('ATTENDANCE_CONFIG_RELATION_INVALID', 'LESION_VALOR');
    }

    return true;
  }

  function getStudentMetrics(studentId) {
    var rows = attendanceRepository.getAll().filter(function(row) {
      return row.ALUMNO_ID === studentId;
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
