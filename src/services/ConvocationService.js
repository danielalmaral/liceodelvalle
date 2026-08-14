function createConvocationService(dependencies) {
  return { dependencies };
}

if (typeof module !== 'undefined') {
  module.exports = { createConvocationService };
}
