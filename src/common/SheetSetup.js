function setupSheetWithHeaders(spreadsheet, sheetName, headers) {
  if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function' || typeof spreadsheet.insertSheet !== 'function') {
    throw new Error('SHEET_SETUP_INVALID_ADAPTER');
  }

  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return { created: true, headersWritten: true };
  }

  var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var compatible = headers.every(function(header, index) {
    return String(existing[index] || '').trim() === header;
  });

  if (!compatible) {
    throw new Error('SHEET_HEADERS_INCOMPATIBLE: ' + sheetName);
  }

  return { created: false, headersWritten: false };
}

if (typeof module !== 'undefined') {
  module.exports = { setupSheetWithHeaders };
}
