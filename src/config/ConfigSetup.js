const CONFIG_HEADERS = Object.freeze([
  'CONFIG_ID',
  'GRUPO',
  'CLAVE',
  'VALOR',
  'TIPO',
  'UNIDAD',
  'ACTIVO',
  'DESCRIPCION',
  'MODIFICADO_EN',
  'MODIFICADO_POR'
]);

function createConfigSetupError(code, detail) {
  return new Error(detail ? `${code}: ${detail}` : code);
}

function normalizeHeaderRow(row) {
  return row.map((value) => String(value || '').trim());
}

function headersMatch(existingHeaders) {
  const normalized = normalizeHeaderRow(existingHeaders);

  return CONFIG_HEADERS.every((header, index) => normalized[index] === header);
}

function setupConfigSheet(spreadsheet) {
  if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function' || typeof spreadsheet.insertSheet !== 'function') {
    throw createConfigSetupError('CONFIG_SCHEMA_INVALID', 'Spreadsheet adapter is required');
  }

  let sheet = spreadsheet.getSheetByName('CONFIG');

  if (!sheet) {
    sheet = spreadsheet.insertSheet('CONFIG');
  }

  if (typeof sheet.getLastRow !== 'function' || typeof sheet.getRange !== 'function') {
    throw createConfigSetupError('CONFIG_SCHEMA_INVALID', 'Sheet adapter is required');
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CONFIG_HEADERS.length).setValues([CONFIG_HEADERS]);
    return { created: true, headersWritten: true };
  }

  const existingHeaders = sheet.getRange(1, 1, 1, CONFIG_HEADERS.length).getValues()[0];

  if (!headersMatch(existingHeaders)) {
    throw createConfigSetupError('CONFIG_SCHEMA_INVALID', 'CONFIG headers are incompatible');
  }

  return { created: false, headersWritten: false };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG_HEADERS,
    setupConfigSheet
  };
}
