function setupCompetitionSheets(spreadsheet, setupFn) {
  setupFn(spreadsheet, 'PARTIDOS', MATCH_HEADERS);
  setupFn(spreadsheet, 'CONVOCATORIAS', CONVOCATION_HEADERS);
  setupFn(spreadsheet, 'CONVOCATORIA_DETALLE', CONVOCATION_DETAIL_HEADERS);
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { setupCompetitionSheets };
}
