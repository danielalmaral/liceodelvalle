var PANEL_HEADERS = Object.freeze([
  'SECCION',
  'CONTENIDO',
  'ACTUALIZADO_EN'
]);

function setupPanelSheet(spreadsheet, setupFn) {
  setupFn(spreadsheet, 'PANEL', PANEL_HEADERS);

  return { sheetName: 'PANEL', authority: false };
}

if (typeof globalThis !== 'undefined') {
  globalThis.PANEL_HEADERS = PANEL_HEADERS;
  globalThis.setupPanelSheet = setupPanelSheet;
}

if (typeof module !== 'undefined') {
  module.exports = {
    PANEL_HEADERS,
    setupPanelSheet
  };
}
