const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { setupSheetWithHeaders } = require('../../src/common/SheetSetup');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
require('../../src/domain/MatchContracts');
require('../../src/domain/ConvocationContracts');
require('../../src/domain/AttendanceContracts');
const { setupCompetitionSheets } = require('../../src/config/CompetitionSetup');
const { createMatchService } = require('../../src/services/MatchService');
const { createAttendanceFoundationService } = require('../../src/services/AttendanceFoundationService');

function match(overrides = {}) {
  return {
    PARTIDO_ID: 'PAR-001',
    COMPETENCIA: 'A',
    JORNADA: 'J1',
    RIVAL: 'Rival Ficticio',
    FECHA: '2026-02-01',
    HORA_CITACION: '09:00',
    HORA_PARTIDO: '10:00',
    SEDE: 'Cancha Ficticia',
    LOCAL_VISITANTE: 'LOCAL',
    DURACION_MINUTOS: '60',
    UNIFORME: '',
    INDICACIONES: '',
    ESTADO: 'PROGRAMADO',
    GOLES_FAVOR: '',
    GOLES_CONTRA: '',
    OBSERVACIONES: '',
    ...overrides
  };
}

function session(overrides = {}) {
  return {
    SESION_ID: 'SES-001',
    TIPO: 'PARTIDO',
    FECHA: '2026-02-01',
    HORA_INICIO: '10:00',
    HORA_FIN: '11:00',
    COMPETENCIA: 'A',
    PARTIDO_ID: 'PAR-001',
    DESCRIPCION: '',
    ESTADO: 'ABIERTA',
    CREADA_EN: '',
    CERRADA_EN: '',
    ...overrides
  };
}

function matchService(rows = [match()]) {
  return createMatchService({
    matchRepository: createArrayRepository(rows),
    utils
  });
}

function sessionService(sessions = [session()], matches = [match()]) {
  return createAttendanceFoundationService({
    attendanceRepository: createArrayRepository([]),
    configService: {},
    matchRepository: createArrayRepository(matches),
    sessionRepository: createArrayRepository(sessions),
    studentRepository: createArrayRepository([]),
    utils
  });
}

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

test('MATCH_SCHEMA_TEST validates required match fields', () => {
  assert.equal(matchService().getMatches()[0].partidoId, 'PAR-001');
  assert.throws(() => matchService([match({ RIVAL: '' })]).getMatches(), /REQUIRED_FIELD: RIVAL/);
});

test('MATCH_ID_UNIQUENESS_TEST rejects duplicate PARTIDO_ID', () => {
  assert.throws(() => matchService([match(), match({ RIVAL: 'Otro' })]).getMatches(), /MATCH_DUPLICATE_ID/);
});

test('MATCH_COMPETITION_TEST validates competition', () => {
  assert.throws(() => matchService([match({ COMPETENCIA: 'GENERAL' })]).getMatches(), /INVALID_ENUM: COMPETENCIA/);
});

test('MATCH_STATUS_TEST validates status', () => {
  assert.throws(() => matchService([match({ ESTADO: 'BORRADOR' })]).getMatches(), /INVALID_ENUM: ESTADO/);
});

test('MATCH_SCORE_TEST requires non-negative scores when played', () => {
  assert.throws(() => matchService([match({ ESTADO: 'JUGADO', GOLES_FAVOR: '', GOLES_CONTRA: 0 })]).getMatches(), /MATCH_SCORE_REQUIRED/);
  assert.throws(() => matchService([match({ ESTADO: 'JUGADO', GOLES_FAVOR: -1, GOLES_CONTRA: 0 })]).getMatches(), /MATCH_SCORE_INVALID/);
});

test('MATCH_TIME_ORDER_TEST requires citacion before partido', () => {
  assert.throws(() => matchService([match({ HORA_CITACION: '11:00', HORA_PARTIDO: '10:00' })]).getMatches(), /MATCH_TIME_ORDER/);
});

test('MATCH_DURATION_TEST requires positive integer duration', () => {
  assert.throws(() => matchService([match({ DURACION_MINUTOS: '0' })]).getMatches(), /MATCH_DURATION_INVALID/);
});

test('MATCH_JORNADA_REQUIRED_TEST rejects undefined jornada', () => {
  assert.throws(() => matchService([match({ JORNADA: undefined })]).getMatches(), /REQUIRED_FIELD: JORNADA/);
  assert.throws(() => matchService([match({ JORNADA: null })]).getMatches(), /REQUIRED_FIELD: JORNADA/);
  assert.throws(() => matchService([match({ JORNADA: '   ' })]).getMatches(), /REQUIRED_FIELD: JORNADA/);
});

test('MATCH_JORNADA_STRING_TEST accepts string jornada', () => {
  assert.equal(matchService([match({ JORNADA: '1' })]).getMatches()[0].jornada, '1');
});

test('MATCH_JORNADA_NUMERIC_TEST accepts numeric jornada as string', () => {
  assert.equal(matchService([match({ JORNADA: 1 })]).getMatches()[0].jornada, '1');
});

test('MATCH_JORNADA_NAMED_STAGE_TEST accepts named stage jornada', () => {
  assert.equal(matchService([match({ JORNADA: 'SEMIFINAL' })]).getMatches()[0].jornada, 'SEMIFINAL');
  assert.equal(matchService([match({ JORNADA: 'FINAL' })]).getMatches()[0].jornada, 'FINAL');
});

test('MATCH_SETUP_IDEMPOTENCY_TEST creates and preserves PARTIDOS headers', () => {
  const spreadsheet = fakeSpreadsheet();
  assert.equal(setupCompetitionSheets(spreadsheet, setupSheetWithHeaders), true);
  const rows = spreadsheet.sheets.PARTIDOS.rows.slice();
  assert.equal(setupCompetitionSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.deepEqual(spreadsheet.sheets.PARTIDOS.rows, rows);
});

test('SESSION_MATCH_FK_TEST rejects missing match reference', () => {
  assert.throws(() => sessionService([session()], []).getSessions(), /SESSION_MATCH_FK/);
});

test('SESSION_MATCH_REPOSITORY_REQUIRED_TEST requires PARTIDOS authority for match sessions', () => {
  const service = createAttendanceFoundationService({
    attendanceRepository: createArrayRepository([]),
    configService: {},
    sessionRepository: createArrayRepository([session()]),
    studentRepository: createArrayRepository([]),
    utils
  });
  assert.throws(() => service.getSessions(), /REPOSITORY_READ_REQUIRED: PARTIDOS/);
});

test('SESSION_MATCH_FK_FAIL_CLOSED_TEST rejects match session without matching partido', () => {
  assert.throws(() => sessionService([session({ PARTIDO_ID: 'PAR-MISSING' })], [match()]).getSessions(), /SESSION_MATCH_FK/);
});

test('SESSION_MATCH_REQUIRED_TEST requires match id for match sessions', () => {
  assert.throws(() => sessionService([session({ PARTIDO_ID: '' })]).getSessions(), /SESSION_MATCH_REQUIRED/);
});

test('SESSION_TRAINING_MATCH_EMPTY_TEST requires empty match id for training', () => {
  assert.throws(() => sessionService([session({ TIPO: 'ENTRENAMIENTO', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'GENERAL' })]).getSessions(), /SESSION_TRAINING_MATCH_NOT_EMPTY/);
});

test('SESSION_TRAINING_WITHOUT_MATCH_REPOSITORY_TEST validates training without PARTIDOS authority', () => {
  const service = createAttendanceFoundationService({
    attendanceRepository: createArrayRepository([]),
    configService: {},
    sessionRepository: createArrayRepository([session({ TIPO: 'ENTRENAMIENTO', PARTIDO_ID: '', COMPETENCIA: 'GENERAL' })]),
    studentRepository: createArrayRepository([]),
    utils
  });
  assert.equal(service.getSessions()[0].tipo, 'ENTRENAMIENTO');
});

test('SESSION_MATCH_COMPETITION_ALIGNMENT_TEST validates competition alignment', () => {
  assert.throws(() => sessionService([session({ COMPETENCIA: 'B' })], [match({ COMPETENCIA: 'A' })]).getSessions(), /SESSION_MATCH_COMPETITION_ALIGNMENT/);
});

test('SESSION_MATCH_CANCELLED_REFERENCE_TEST allows historical cancelled match reference', () => {
  assert.equal(sessionService([session()], [match({ ESTADO: 'CANCELADO' })]).getSessions()[0].partidoId, 'PAR-001');
});
