function validateAttendanceConfigPolicy(configService, utils) {
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

if (typeof globalThis !== 'undefined') {
  globalThis.validateAttendanceConfigPolicy = validateAttendanceConfigPolicy;
}

if (typeof module !== 'undefined') {
  module.exports = { validateAttendanceConfigPolicy };
}
