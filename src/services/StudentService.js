function createStudentService(dependencies) {
  return { dependencies };
}

if (typeof module !== 'undefined') {
  module.exports = { createStudentService };
}
