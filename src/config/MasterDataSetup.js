function setupMasterDataSheets(spreadsheet, setupFn) {
  setupFn(spreadsheet, 'ALUMNOS', STUDENT_HEADERS);
  setupFn(spreadsheet, 'TUTORES', TUTOR_HEADERS);
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { setupMasterDataSheets };
}
