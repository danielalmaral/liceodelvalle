function createAttendanceService(dependencies) {
  return { dependencies };
}

if (typeof module !== 'undefined') {
  module.exports = { createAttendanceService };
}
