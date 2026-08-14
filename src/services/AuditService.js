function createAuditService(dependencies) {
  return { dependencies };
}

if (typeof module !== 'undefined') {
  module.exports = { createAuditService };
}
