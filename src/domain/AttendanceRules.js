function createAttendanceRules(configService) {
  return {
    evaluate() {
      throw new Error('Attendance rules are defined in a later phase');
    },
    configService
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAttendanceRules };
}
