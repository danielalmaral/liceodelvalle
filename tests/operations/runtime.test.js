const test = require('node:test');
const assert = require('node:assert/strict');
require('../../src/config/ConfigSetup');
require('../../src/domain/MasterDataContracts');
require('../../src/domain/AttendanceContracts');
require('../../src/domain/MatchContracts');
require('../../src/domain/ConvocationContracts');
require('../../src/domain/ParticipationContracts');
require('../../src/domain/CommunicationContracts');
require('../../src/domain/AuditContracts');
const { setupSheetWithHeaders } = require('../../src/common/SheetSetup');
const { setupOperationalSheets } = require('../../src/config/GlobalSetup');
const { createSheetRepository } = require('../../src/repositories/SheetRepository');
const { createTriggerHandlers } = require('../../src/triggers/TriggerHandlers');
const { createAppsScriptRuntime } = require('../../src/RuntimeComposition');

function fakeSheet(rows = []) {
  return {
    rows,
    getLastRow() { return rows.length; },
    getRange(row, column, rowCount, columnCount) {
      return {
        getValues() {
          return rows.slice(row - 1, row - 1 + rowCount).map((sourceRow) => sourceRow.slice(column - 1, column - 1 + columnCount));
        },
        setValues(values) {
          for (let index = 0; index < rowCount; index += 1) rows[row - 1 + index] = values[index].slice();
        }
      };
    }
  };
}

function fakeSpreadsheet() {
  const sheets = {};
  return {
    sheets,
    getSheetByName(name) { return sheets[name] || null; },
    insertSheet(name) { sheets[name] = fakeSheet(); return sheets[name]; }
  };
}

function repository(rows = [['ID', 'VALUE'], ['A', 'one']]) {
  return createSheetRepository({ sheet: fakeSheet(rows), headers: ['ID', 'VALUE'] });
}

test('SHEET_REPOSITORY_READ_TEST maps rows to records', () => {
  assert.deepEqual(repository().getAll(), [{ ID: 'A', VALUE: 'one' }]);
});

test('SHEET_REPOSITORY_INSERT_TEST appends new row', () => {
  const repo = repository();
  repo.insert({ ID: 'B', VALUE: 'two' });
  assert.equal(repo.getAll().length, 2);
});

test('SHEET_REPOSITORY_UPDATE_TEST updates by stable id', () => {
  const repo = repository();
  repo.updateById('ID', 'A', { ID: 'A', VALUE: 'changed' });
  assert.equal(repo.findById('ID', 'A').VALUE, 'changed');
});

test('SHEET_REPOSITORY_NOT_FOUND_TEST rejects missing id', () => {
  assert.throws(() => repository().updateById('ID', 'Z', { ID: 'Z', VALUE: 'x' }), /SHEET_REPOSITORY_NOT_FOUND/);
});

test('SHEET_REPOSITORY_DUPLICATE_ID_TEST rejects duplicate stable id', () => {
  assert.throws(() => repository([['ID', 'VALUE'], ['A', 'one'], ['A', 'two']]).updateById('ID', 'A', { ID: 'A', VALUE: 'x' }), /SHEET_REPOSITORY_DUPLICATE_ID/);
});

test('SHEET_REPOSITORY_HEADER_INTEGRITY_TEST rejects incompatible headers', () => {
  assert.throws(() => repository([['OTHER', 'VALUE']]).getAll(), /SHEET_REPOSITORY_HEADER_MISMATCH/);
});

test('SHEET_REPOSITORY_COPY_ON_READ_TEST returns copies', () => {
  const repo = repository();
  const rows = repo.getAll();
  rows[0].VALUE = 'mutated';
  assert.equal(repo.getAll()[0].VALUE, 'one');
});

test('SHEET_REPOSITORY_NO_ROW_IDENTITY_TEST updates after physical reorder by id', () => {
  const repo = repository([['ID', 'VALUE'], ['B', 'two'], ['A', 'one']]);
  repo.updateById('ID', 'A', { ID: 'A', VALUE: 'changed' });
  assert.equal(repo.findById('ID', 'A').VALUE, 'changed');
});

test('RUNTIME_COMPOSITION_TEST builds runtime with fake repositories', () => {
  const runtime = createAppsScriptRuntime({
    createTriggerHandlers,
    environment: { getSpreadsheetId: () => 'test-spreadsheet' },
    sheets: { CONFIG: ['ID'] },
    createRepository: (name) => ({ name }),
    factories: { sample: ({ runtime: current }) => ({ id: current.spreadsheetId }) }
  });
  assert.equal(runtime.services.sample.id, 'test-spreadsheet');
});

test('RUNTIME_MISSING_SPREADSHEET_ID_TEST fails closed', () => {
  assert.throws(() => createAppsScriptRuntime({ environment: {}, createTriggerHandlers }), /RUNTIME_SPREADSHEET_ID_REQUIRED/);
});

test('RUNTIME_LOCK_INJECTION_TEST executes through injected lock', () => {
  let locked = false;
  const runtime = createAppsScriptRuntime({
    createTriggerHandlers,
    environment: { spreadsheetId: 'test-spreadsheet' },
    lock: { runExclusive(callback) { locked = true; return callback(); } }
  });
  runtime.runtime.withLock(() => true);
  assert.equal(locked, true);
});

test('RUNTIME_NO_REAL_EXTERNAL_CALL_TEST does not call real adapters during construction', () => {
  let calls = 0;
  createAppsScriptRuntime({ createTriggerHandlers, environment: { spreadsheetId: 'test-spreadsheet' }, factories: { noop: () => { calls += 1; return {}; } } });
  assert.equal(calls, 1);
});

test('TRIGGER_EXPIRED_ABSENCE_IDEMPOTENCY_TEST summarizes expired absence handler', () => {
  let calls = 0;
  const handlers = createTriggerHandlers({ services: { absenceResolutionService: { resolveExpiredAbsences() { calls += 1; return calls === 1 ? [{ attendance: {} }] : []; } } } });
  assert.deepEqual(handlers.expirePendingAbsences(), { processed: 1, succeeded: 1, failed: 0 });
  assert.deepEqual(handlers.expirePendingAbsences(), { processed: 0, succeeded: 0, failed: 0 });
});

test('TRIGGER_COMMUNICATION_IDEMPOTENCY_TEST summarizes pending communications once', () => {
  const handlers = createTriggerHandlers({ services: { communicationService: { sendPendingCommunications() { return [{ ok: true }, { ok: false }]; } } } });
  assert.deepEqual(handlers.sendPendingCommunications(), { processed: 2, succeeded: 1, failed: 1 });
});

test('TRIGGER_PII_FREE_SUMMARY_TEST returns counts only', () => {
  const result = createTriggerHandlers({ services: { communicationService: { sendPendingCommunications() { return [{ ok: false, email: 'family@example.invalid' }]; } } } }).sendPendingCommunications();
  assert.deepEqual(Object.keys(result).sort(), ['failed', 'processed', 'succeeded']);
});

test('GLOBAL_SETUP_IDEMPOTENCY_TEST creates all operational sheets', () => {
  const spreadsheet = fakeSpreadsheet();
  assert.equal(setupOperationalSheets(spreadsheet, setupSheetWithHeaders).sheetCount, 11);
  assert.equal(setupOperationalSheets(spreadsheet, setupSheetWithHeaders).sheetCount, 11);
});

test('GLOBAL_SETUP_PRESERVES_DATA_TEST does not clear existing rows', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  spreadsheet.sheets.ALUMNOS.rows.push(['ALU-001']);
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(spreadsheet.sheets.ALUMNOS.rows.length, 2);
});

test('GLOBAL_SETUP_HEADER_FAILURE_TEST rejects incompatible headers', () => {
  const spreadsheet = fakeSpreadsheet();
  spreadsheet.sheets.CONFIG = fakeSheet([['WRONG']]);
  assert.throws(() => setupOperationalSheets(spreadsheet, setupSheetWithHeaders), /SHEET_HEADERS_INCOMPATIBLE/);
});

test('GAS_RUNTIME_COMPATIBILITY_TEST builds runtime with fakes only', () => {
  const runtime = createAppsScriptRuntime({ createTriggerHandlers, environment: { spreadsheetId: 'test-spreadsheet' } });
  assert.equal(runtime.runtime.spreadsheetId, 'test-spreadsheet');
});
