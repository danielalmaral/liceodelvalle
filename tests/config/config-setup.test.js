const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIG_HEADERS, setupConfigSheet } = require('../../src/config/ConfigSetup');

function createFakeSheet(existingRows = []) {
  const rows = existingRows;

  return {
    rows,
    getLastRow() {
      return rows.length;
    },
    getRange(row, column, rowCount, columnCount) {
      return {
        getValues() {
          return rows.slice(row - 1, row - 1 + rowCount).map((sourceRow) => {
            return sourceRow.slice(column - 1, column - 1 + columnCount);
          });
        },
        setValues(values) {
          for (let index = 0; index < rowCount; index += 1) {
            rows[row - 1 + index] = values[index].slice();
          }
        }
      };
    }
  };
}

function createFakeSpreadsheet(sheet) {
  return {
    sheet,
    getSheetByName(name) {
      return name === 'CONFIG' ? this.sheet : null;
    },
    insertSheet(name) {
      assert.equal(name, 'CONFIG');
      this.sheet = createFakeSheet();
      return this.sheet;
    }
  };
}

test('setup creates CONFIG headers when sheet is missing', () => {
  const spreadsheet = createFakeSpreadsheet(null);

  const result = setupConfigSheet(spreadsheet);

  assert.deepEqual(spreadsheet.sheet.rows[0], CONFIG_HEADERS);
  assert.deepEqual(result, { created: true, headersWritten: true });
});

test('setup is idempotent when compatible headers already exist', () => {
  const sheet = createFakeSheet([CONFIG_HEADERS.slice(), ['existing data']]);
  const spreadsheet = createFakeSpreadsheet(sheet);

  const result = setupConfigSheet(spreadsheet);

  assert.deepEqual(sheet.rows, [CONFIG_HEADERS.slice(), ['existing data']]);
  assert.deepEqual(result, { created: false, headersWritten: false });
});

test('setup rejects incompatible headers without destroying data', () => {
  const sheet = createFakeSheet([['CLAVE', 'VALOR'], ['existing data']]);
  const spreadsheet = createFakeSpreadsheet(sheet);

  assert.throws(() => setupConfigSheet(spreadsheet), /CONFIG_SCHEMA_INVALID/);
  assert.deepEqual(sheet.rows, [['CLAVE', 'VALOR'], ['existing data']]);
});
