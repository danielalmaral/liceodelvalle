function createSheetRepository(context) {
  var sheet = context.sheet;
  var headers = context.headers;

  function copyRecord(record) {
    var next = {};
    Object.keys(record).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function assertHeaders() {
    if (!sheet || typeof sheet.getRange !== 'function' || typeof sheet.getLastRow !== 'function') {
      throw new Error('SHEET_REPOSITORY_INVALID_ADAPTER');
    }

    if (sheet.getLastRow() === 0) {
      throw new Error('SHEET_REPOSITORY_HEADERS_MISSING');
    }

    var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    headers.forEach(function(header, index) {
      if (String(existing[index] || '').trim() !== header) {
        throw new Error('SHEET_REPOSITORY_HEADER_MISMATCH: ' + header);
      }
    });

    if (typeof sheet.getLastColumn === 'function' && sheet.getLastColumn() > headers.length) {
      var extra = sheet.getRange(1, headers.length + 1, 1, sheet.getLastColumn() - headers.length).getValues()[0];
      if (extra.some(function(value) { return String(value || '').trim() !== ''; })) {
        throw new Error('SHEET_REPOSITORY_HEADER_MISMATCH: EXTRA_COLUMN');
      }
    }
  }

  function rowToRecord(values) {
    var record = {};
    headers.forEach(function(header, index) {
      record[header] = values[index] === undefined ? '' : values[index];
    });
    return record;
  }

  function recordToRow(record) {
    return headers.map(function(header) {
      return record[header] === undefined ? '' : record[header];
    });
  }

  function getAll() {
    assertHeaders();
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return [];
    }
    return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues().map(rowToRecord).map(copyRecord);
  }

  function insert(record) {
    assertHeaders();
    var nextRow = recordToRow(record);
    var rowNumber = sheet.getLastRow() + 1;
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([nextRow]);
    return copyRecord(record);
  }

  function updateById(idField, id, nextRecord) {
    assertHeaders();

    if (nextRecord[idField] !== id) {
      throw new Error('SHEET_REPOSITORY_IDENTITY_MUTATION: ' + id);
    }

    var all = getAll();
    var matches = [];

    all.forEach(function(record, index) {
      if (record[idField] === id) {
        matches.push(index);
      }
    });

    if (matches.length === 0) {
      throw new Error('SHEET_REPOSITORY_NOT_FOUND: ' + id);
    }

    if (matches.length > 1) {
      throw new Error('SHEET_REPOSITORY_DUPLICATE_ID: ' + id);
    }

    sheet.getRange(matches[0] + 2, 1, 1, headers.length).setValues([recordToRow(nextRecord)]);
    return copyRecord(nextRecord);
  }

  function findById(idField, id) {
    var matches = getAll().filter(function(record) {
      return record[idField] === id;
    });

    if (matches.length > 1) {
      throw new Error('SHEET_REPOSITORY_DUPLICATE_ID: ' + id);
    }

    return matches[0] || null;
  }

  return {
    findById: findById,
    getAll: getAll,
    insert: insert,
    updateById: updateById
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createSheetRepository };
}
