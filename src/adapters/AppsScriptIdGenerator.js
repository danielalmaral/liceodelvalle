function createAppsScriptIdGenerator(uuidProvider) {
  function uuid() {
    if (uuidProvider && typeof uuidProvider.getUuid === 'function') {
      return uuidProvider.getUuid();
    }

    if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.getUuid === 'function') {
      return Utilities.getUuid();
    }

    throw new Error('RUNTIME_UUID_PROVIDER_REQUIRED');
  }

  function prefixed(prefix) {
    return prefix + uuid();
  }

  return {
    attendanceId: function() { return prefixed('AST-'); },
    auditId: function() { return prefixed('AUD-'); },
    communicationId: function() { return prefixed('COM-'); },
    convocationId: function() { return prefixed('CON-'); },
    detailId: function() { return prefixed('DET-'); },
    matchId: function() { return prefixed('PAR-'); },
    operationId: function() { return prefixed('OP-'); },
    participationId: function() { return prefixed('PRT-'); },
    sessionId: function() { return prefixed('SES-'); },
    studentId: function() { return prefixed('ALU-'); },
    tutorId: function() { return prefixed('TUT-'); }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppsScriptIdGenerator };
}
