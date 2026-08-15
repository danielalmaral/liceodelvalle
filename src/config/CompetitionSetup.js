function setupCompetitionSheets(spreadsheet, setupFn) {
  setupFn(spreadsheet, 'PARTIDOS', MATCH_HEADERS);
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { setupCompetitionSheets };
}
