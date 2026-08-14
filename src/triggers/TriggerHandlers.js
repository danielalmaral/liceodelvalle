function createTriggerHandlers(dependencies) {
  return { dependencies };
}

if (typeof module !== 'undefined') {
  module.exports = { createTriggerHandlers };
}
