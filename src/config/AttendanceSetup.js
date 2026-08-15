function setupAttendanceSheets(spreadsheet, setupFn) {
  setupFn(spreadsheet, 'SESIONES', SESSION_HEADERS);
  setupFn(spreadsheet, 'ASISTENCIAS', ATTENDANCE_HEADERS);
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { setupAttendanceSheets };
}
