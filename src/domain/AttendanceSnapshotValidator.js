function isBlankSnapshot(value) {
  return value === null || value === undefined || value === '';
}

function parseSnapshotNumber(value, fieldName, utils) {
  var numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw utils.createDomainError('ATTENDANCE_CORRUPT_SNAPSHOT', fieldName);
  }

  return numberValue;
}

function validateAttendanceSnapshot(record, utils) {
  if (record.ESTADO === 'F') {
    if (!isBlankSnapshot(record.VALOR_APLICADO) || !isBlankSnapshot(record.VALOR_MAXIMO_APLICADO)) {
      throw utils.createDomainError('ATTENDANCE_PENDING_SNAPSHOT_NOT_NULL', record.ASISTENCIA_ID);
    }

    return true;
  }

  if (['A', 'R', 'FJ', 'FI', 'LES'].indexOf(record.ESTADO) !== -1) {
    if (isBlankSnapshot(record.VALOR_APLICADO) || isBlankSnapshot(record.VALOR_MAXIMO_APLICADO)) {
      throw utils.createDomainError('ATTENDANCE_FINALIZED_SNAPSHOT_REQUIRED', record.ASISTENCIA_ID);
    }

    var value = parseSnapshotNumber(record.VALOR_APLICADO, 'VALOR_APLICADO', utils);
    var max = parseSnapshotNumber(record.VALOR_MAXIMO_APLICADO, 'VALOR_MAXIMO_APLICADO', utils);

    if (!(max > 0)) {
      throw utils.createDomainError('ATTENDANCE_CORRUPT_SNAPSHOT', 'VALOR_MAXIMO_APLICADO');
    }

    if (value < 0 || value > max) {
      throw utils.createDomainError('ATTENDANCE_SNAPSHOT_RANGE', record.ASISTENCIA_ID);
    }

    return true;
  }

  throw utils.createDomainError('INVALID_ENUM', 'ESTADO');
}

if (typeof globalThis !== 'undefined') {
  globalThis.isBlankSnapshot = isBlankSnapshot;
  globalThis.validateAttendanceSnapshot = validateAttendanceSnapshot;
}

if (typeof module !== 'undefined') {
  module.exports = {
    isBlankSnapshot,
    validateAttendanceSnapshot
  };
}
