function createCommunicationService(dependencies) {
  return { dependencies };
}

if (typeof module !== 'undefined') {
  module.exports = { createCommunicationService };
}
