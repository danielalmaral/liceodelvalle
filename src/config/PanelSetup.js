var PANEL_HEADERS = Object.freeze([
  'SECCION',
  'CONTENIDO',
  'ACTUALIZADO_EN'
]);

function setupPanelSheet(spreadsheet, setupFn) {
  var sheet;
  var existingRows;
  var existingSections = {};
  var landingRows = [
    ['BIENVENIDA', 'Liceo del Valle - Futbol', ''],
    ['AYUDA', 'Usa el menu Liceo del Valle > Abrir Panel', ''],
    ['ESTADO', 'El PANEL es una interfaz; no edites hojas operativas directamente.', '']
  ];

  setupFn(spreadsheet, 'PANEL', PANEL_HEADERS);
  sheet = spreadsheet.getSheetByName('PANEL');

  if (sheet && typeof sheet.getLastRow === 'function' && sheet.getLastRow() > 1) {
    existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, PANEL_HEADERS.length).getValues();
    existingRows.forEach(function(row) {
      existingSections[String(row[0] || '').trim()] = true;
    });
  }

  landingRows.forEach(function(row) {
    if (!existingSections[row[0]]) {
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, PANEL_HEADERS.length).setValues([row]);
      existingSections[row[0]] = true;
    }
  });

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
