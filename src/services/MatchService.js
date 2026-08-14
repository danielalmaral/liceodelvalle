function createMatchService(dependencies) {
  return { dependencies };
}

if (typeof module !== 'undefined') {
  module.exports = { createMatchService };
}
