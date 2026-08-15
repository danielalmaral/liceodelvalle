const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
require('../../src/config/ConfigSetup');
require('../../src/config/PanelSetup');
require('../../src/domain/MasterDataContracts');
require('../../src/domain/AttendanceContracts');
require('../../src/domain/MatchContracts');
require('../../src/domain/ConvocationContracts');
require('../../src/domain/ParticipationContracts');
require('../../src/domain/CommunicationContracts');
require('../../src/domain/AuditContracts');
const { validateAttendanceConfigPolicy } = require('../../src/domain/AttendanceConfigPolicy');
const { validateAttendanceSnapshot } = require('../../src/domain/AttendanceSnapshotValidator');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
const { setupSheetWithHeaders } = require('../../src/common/SheetSetup');
const { setupOperationalSheets } = require('../../src/config/GlobalSetup');
const { createSheetRepository } = require('../../src/repositories/SheetRepository');
const { createTriggerHandlers } = require('../../src/triggers/TriggerHandlers');
const { createAppsScriptRuntime } = require('../../src/RuntimeComposition');
const { createConfigService } = require('../../src/config/ConfigService');
const { createMasterDataService } = require('../../src/services/MasterDataService');
const { createAttendanceFoundationService } = require('../../src/services/AttendanceFoundationService');
const { createAbsenceResolutionService } = require('../../src/services/AbsenceResolutionService');
const { createAttendanceMetricsService } = require('../../src/services/AttendanceMetricsService');
const { createMatchService } = require('../../src/services/MatchService');
const { createEligibilityService } = require('../../src/services/EligibilityService');
const { createRotationService } = require('../../src/services/RotationService');
const { createConvocationService } = require('../../src/services/ConvocationService');
const { createParticipationService } = require('../../src/services/ParticipationService');
const { createCommunicationService } = require('../../src/services/CommunicationService');
const { createAuditService } = require('../../src/services/AuditService');
const { createOperationalCommandService } = require('../../src/services/OperationalCommandService');
const { createPanelQueryService } = require('../../src/services/PanelQueryService');
const { createSessionService } = require('../../src/services/SessionService');
const { completeConfigRows } = require('../config/config-fixtures');

function fakeSheet(rows = []) {
  return {
    rows,
    getLastRow() { return rows.length; },
    getLastColumn() { return rows[0] ? rows[0].length : 0; },
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

function student() {
  return {
    ALUMNO_ID: 'ALU-001',
    ACTIVO: true,
    NOMBRE: 'Alumno',
    APELLIDOS: 'Ficticio',
    GRADO: '7',
    GRUPO: 'A',
    COMPETENCIA_BASE: 'A',
    NIVEL: 'A1',
    POSICION_PRINCIPAL: 'DEF',
    POSICION_SECUNDARIA: '',
    FECHA_ALTA: '2026-01-01',
    FECHA_BAJA: '',
    ESTADO_DEPORTIVO: 'ACTIVO',
    OBSERVACIONES: ''
  };
}

function tutor() {
  return {
    TUTOR_ID: 'TUT-001',
    ALUMNO_ID: 'ALU-001',
    NOMBRE_TUTOR: 'Tutor',
    PARENTESCO: 'Padre',
    EMAIL: 'family@example.invalid',
    TELEFONO: '',
    PRINCIPAL: true,
    RECIBE_AUSENCIAS: true,
    RECIBE_CONVOCATORIAS: true,
    ACTIVO: true
  };
}

function match() {
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
    OBSERVACIONES: ''
  };
}

function session() {
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
    CERRADA_EN: ''
  };
}

function runtimeOptions(overrides = {}) {
  return {
    constructors: {
      createAbsenceResolutionService,
      createAttendanceFoundationService,
      createAttendanceMetricsService,
      createAuditService,
      createCommunicationService,
      createConfigService,
      createConvocationService,
      createEligibilityService,
      createMasterDataService,
      createMatchService,
      createOperationalCommandService,
      createPanelQueryService,
      createParticipationService,
      createRotationService,
      createSessionService,
      validateAttendanceConfigPolicy,
      validateAttendanceSnapshot
    },
    createTriggerHandlers,
    environment: { spreadsheetId: 'test-spreadsheet' },
    idGenerator: {
      attendanceId: () => 'AST-NEW',
      operationId: (prefix) => `${prefix}-001`,
      participationId: () => 'PRT-001'
    },
    lock: { runExclusive(callback) { return callback(); } },
    mailAdapter: { send() {} },
    repositories: {
      auditRepository: createArrayRepository([]),
      attendanceRepository: createArrayRepository([]),
      communicationRepository: createArrayRepository([]),
      configRepository: createConfigRepository(completeConfigRows()),
      convocationRepository: createArrayRepository([]),
      detailRepository: createArrayRepository([]),
      matchRepository: createArrayRepository([match()]),
      participationRepository: createArrayRepository([]),
      sessionRepository: createArrayRepository([session()]),
      studentRepository: createArrayRepository([student()]),
      tutorRepository: createArrayRepository([tutor()])
    },
    utils,
    ...overrides
  };
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

test('SHEET_REPOSITORY_IDENTITY_MUTATION_TEST rejects id mutation on update', () => {
  assert.throws(() => repository().updateById('ID', 'A', { ID: 'B', VALUE: 'changed' }), /SHEET_REPOSITORY_IDENTITY_MUTATION/);
});

test('SHEET_REPOSITORY_FIND_DUPLICATE_TEST fails closed on duplicate find', () => {
  assert.throws(() => repository([['ID', 'VALUE'], ['A', 'one'], ['A', 'two']]).findById('ID', 'A'), /SHEET_REPOSITORY_DUPLICATE_ID/);
});

test('SHEET_REPOSITORY_EXTRA_HEADER_TEST rejects extra non-empty header', () => {
  assert.throws(() => repository([['ID', 'VALUE', 'EXTRA'], ['A', 'one', 'x']]).getAll(), /SHEET_REPOSITORY_HEADER_MISMATCH/);
});

test('RUNTIME_COMPOSITION_TEST builds runtime with fake repositories', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions({ environment: { getSpreadsheetId: () => 'test-spreadsheet' } }));
  assert.equal(runtime.runtime.spreadsheetId, 'test-spreadsheet');
  assert.equal(typeof runtime.queries.getStudents, 'function');
  assert.equal(typeof runtime.commands.createAttendance, 'function');
});

test('RUNTIME_FULL_GRAPH_COMPOSITION_TEST builds all P1-P13 services and commands', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  [
    'getStudents',
    'getTutors',
    'getSessions',
    'getAttendances',
    'getStudentMetrics',
    'getMatches',
    'evaluateMatch',
    'getRotationBefore',
    'getParticipations',
    'validateMatchParticipationReadiness',
    'getCommunications',
    'getEvents',
    'getPanelDashboard',
    'getPanelAttendance',
    'getPanelConvocation',
    'getPanelParticipation'
  ].forEach((name) => assert.equal(typeof runtime.queries[name], 'function'));
  assert.equal(typeof runtime.commands.approveConvocation, 'function');
  assert.equal(typeof runtime.commands.createSession, 'function');
  assert.equal(typeof runtime.commands.createMatch, 'function');
  assert.equal(typeof runtime.commands.updateStudentSportsState, 'function');
});

test('RUNTIME_MISSING_REQUIRED_REPOSITORY_TEST fails closed on missing repository', () => {
  const options = runtimeOptions();
  delete options.repositories.auditRepository;
  assert.throws(() => createAppsScriptRuntime(options), /RUNTIME_REPOSITORY_REQUIRED: auditRepository/);
});

test('RUNTIME_MISSING_CONFIG_DEPENDENCY_TEST fails closed on missing constructor', () => {
  const options = runtimeOptions();
  delete options.constructors.createConfigService;
  assert.throws(() => createAppsScriptRuntime(options), /RUNTIME_CONFIG_DEPENDENCY_REQUIRED: createConfigService/);
});

test('RUNTIME_MISSING_SPREADSHEET_ID_TEST fails closed', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions({ environment: {} })), /RUNTIME_SPREADSHEET_ID_REQUIRED/);
});

test('RUNTIME_LOCK_INJECTION_TEST executes through injected lock', () => {
  let locked = false;
  const runtime = createAppsScriptRuntime(runtimeOptions({
    lock: { runExclusive(callback) { locked = true; return callback(); } }
  }));
  runtime.runtime.withLock(() => true);
  assert.equal(locked, true);
});

test('RUNTIME_CRITICAL_WRITE_LOCK_TEST runs command writes inside lock callback', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.repositories.attendanceRepository = createArrayRepository([{ ASISTENCIA_ID: 'AST-001', ESTADO: 'F' }]);
  options.repositories.auditRepository = {
    getAll() { return []; },
    insert(record) { observedInside = insideLock; return record; }
  };
  options.constructors.createAbsenceResolutionService = () => ({
    resolveAbsence() { return { attendance: { ASISTENCIA_ID: 'AST-001', ESTADO: 'FJ' } }; },
    resolveExpiredAbsences() { return []; }
  });
  const runtime = createAppsScriptRuntime(options);
  runtime.commands.resolveAbsence('AST-001', 'FJ');
  assert.equal(observedInside, true);
});

test('RUNTIME_APPROVAL_LOCK_TEST locks convocation approval command', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.constructors.createConvocationService = () => ({
    approveConvocation() { observedInside = insideLock; return { CONVOCATORIA_ID: 'CON-001', ESTADO: 'APROBADA' }; }
  });
  createAppsScriptRuntime(options).commands.approveConvocation('CON-001', 'coach');
  assert.equal(observedInside, true);
});

test('RUNTIME_ATTENDANCE_LOCK_TEST locks create attendance command', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.repositories.attendanceRepository = {
    getAll() { return []; },
    insert(record) { observedInside = insideLock; return record; }
  };
  createAppsScriptRuntime(options).commands.createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' });
  assert.equal(observedInside, true);
});

test('RUNTIME_PARTICIPATION_LOCK_TEST locks participation command', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.repositories.participationRepository = createArrayRepository([{ PARTICIPACION_ID: 'PRT-001', MINUTOS_JUGADOS: 0 }]);
  options.constructors.createParticipationService = () => ({
    getParticipations() { return []; },
    updateParticipation() { observedInside = insideLock; return { PARTICIPACION_ID: 'PRT-001', MINUTOS_JUGADOS: 1 }; },
    validateMatchParticipationReadiness() { return { ready: true, errors: [], alerts: [] }; }
  });
  createAppsScriptRuntime(options).commands.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 1 });
  assert.equal(observedInside, true);
});

test('RUNTIME_COMMUNICATION_LOCK_TEST locks communication command', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.constructors.createCommunicationService = () => ({
    generateAbsenceCommunications() { return { created: [] }; },
    generateConvocationCommunications() { return { created: [] }; },
    getCommunications() { return []; },
    retryCommunication() { return { communication: { COMUNICACION_ID: 'COM-001', ESTADO: 'ERROR' } }; },
    sendPendingCommunications() { observedInside = insideLock; return []; }
  });
  createAppsScriptRuntime(options).commands.sendPendingCommunications();
  assert.equal(observedInside, true);
});

test('RUNTIME_MUTATION_BYPASS_BLOCKED_TEST does not expose mutable services', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  [
    'createAttendance',
    'resolveAbsence',
    'resolveExpiredAbsences',
    'generateConvocation',
    'setFinalSelection',
    'assignPlayerPosition',
    'approveConvocation',
    'createSession',
    'closeSession',
    'createMatch',
    'updateMatch',
    'markMatchPlayed',
    'cancelMatch',
    'updateStudentSportsState',
    'createParticipation',
    'updateParticipation',
    'generateAbsenceCommunications',
    'generateConvocationCommunications',
    'sendPendingCommunications',
    'retryCommunication',
    'appendEvent'
  ].forEach((name) => assert.equal(runtime.services[name], undefined));
});

test('RUNTIME_REPOSITORY_MUTATION_BYPASS_BLOCKED_TEST does not expose repositories or repository mutations', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  assert.equal(runtime.repositories, undefined);

  [runtime.queries, runtime.services, runtime.runtime].forEach((facade) => {
    assert.equal(facade.insert, undefined);
    assert.equal(facade.updateById, undefined);
    assert.equal(facade.append, undefined);
    Object.keys(facade).forEach((name) => {
      if (typeof facade[name] === 'object' && facade[name] !== null) {
        assert.equal(facade[name].insert, undefined);
        assert.equal(facade[name].updateById, undefined);
      }
    });
  });
});

test('RUNTIME_COMMAND_ONLY_MUTATION_SURFACE_TEST exposes mutations only on commands', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  [
    'createAttendance',
    'resolveAbsence',
    'resolveExpiredAbsences',
    'generateConvocation',
    'setFinalSelection',
    'assignPlayerPosition',
    'approveConvocation',
    'createSession',
    'closeSession',
    'createMatch',
    'updateMatch',
    'markMatchPlayed',
    'cancelMatch',
    'updateStudentSportsState',
    'createParticipation',
    'updateParticipation',
    'generateAbsenceCommunications',
    'generateConvocationCommunications',
    'sendPendingCommunications',
    'retryCommunication',
    'appendAudit'
  ].forEach((name) => {
    assert.equal(typeof runtime.commands[name], 'function');
    assert.equal(runtime.queries[name], undefined);
    assert.equal(runtime.services[name], undefined);
    assert.equal(runtime.runtime[name], undefined);
  });
});

test('RUNTIME_READ_ONLY_QUERY_FACADE_TEST exposes read-only facades', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  assert.equal(typeof runtime.services.getStudents, 'function');
  assert.equal(typeof runtime.services.getEvents, 'function');
  assert.equal(runtime.services.approveConvocation, undefined);
});

test('RUNTIME_GENERATE_CONVOCATION_LOCK_TEST locks generation command', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.constructors.createConvocationService = () => ({
    generateConvocation() { observedInside = insideLock; return { CONVOCATORIA_ID: 'CON-001' }; }
  });
  createAppsScriptRuntime(options).commands.generateConvocation('PAR-001');
  assert.equal(observedInside, true);
});

test('RUNTIME_GENERATE_CONVOCATION_ACTOR_PASSTHROUGH_TEST preserves actor argument', () => {
  let observedActor = '';
  const options = runtimeOptions();
  options.constructors.createConvocationService = () => ({
    generateConvocation(matchId, actor) {
      observedActor = actor;
      return { CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: matchId, GENERADA_POR: actor };
    }
  });
  const result = createAppsScriptRuntime(options).commands.generateConvocation('PAR-001', 'coach');
  assert.equal(observedActor, 'coach');
  assert.equal(result.GENERADA_POR, 'coach');
});

test('RUNTIME_GENERATE_ABSENCE_COMMUNICATION_LOCK_TEST locks absence communication generation', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.constructors.createCommunicationService = () => ({
    generateAbsenceCommunications() { observedInside = insideLock; return { created: [] }; },
    generateConvocationCommunications() { return { created: [] }; },
    getCommunications() { return []; },
    retryCommunication() { return { communication: { COMUNICACION_ID: 'COM-001', ESTADO: 'ERROR' } }; },
    sendPendingCommunications() { return []; }
  });
  createAppsScriptRuntime(options).commands.generateAbsenceCommunications('AST-001');
  assert.equal(observedInside, true);
});

test('RUNTIME_GENERATE_CONVOCATION_COMMUNICATION_LOCK_TEST locks convocation communication generation', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.constructors.createCommunicationService = () => ({
    generateAbsenceCommunications() { return { created: [] }; },
    generateConvocationCommunications() { observedInside = insideLock; return { created: [] }; },
    getCommunications() { return []; },
    retryCommunication() { return { communication: { COMUNICACION_ID: 'COM-001', ESTADO: 'ERROR' } }; },
    sendPendingCommunications() { return []; }
  });
  createAppsScriptRuntime(options).commands.generateConvocationCommunications('CON-001');
  assert.equal(observedInside, true);
});

test('RUNTIME_AUDIT_LOCK_TEST locks audit append command', () => {
  let insideLock = false;
  let observedInside = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { insideLock = true; try { return callback(); } finally { insideLock = false; } } }
  });
  options.repositories.auditRepository = {
    getAll() { return []; },
    insert(record) { observedInside = insideLock; return record; }
  };
  createAppsScriptRuntime(options).commands.appendAudit({ EVENTO_ID: 'AUD-LOCK', ENTIDAD: 'X', ENTIDAD_ID: '1', ACCION: 'A' });
  assert.equal(observedInside, true);
});

test('RUNTIME_ROTATION_QUERY_SIGNATURE_TEST forwards student and competition', () => {
  const options = runtimeOptions();
  options.repositories.convocationRepository = createArrayRepository([
    { CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA' }
  ]);
  options.repositories.detailRepository = createArrayRepository([
    {
      DETALLE_ID: 'DET-001',
      CONVOCATORIA_ID: 'CON-001',
      ALUMNO_ID: 'ALU-001',
      COMPETENCIA_SNAPSHOT: 'A',
      ELEGIBILITY_STATUS: 'ELIGIBLE',
      SELECCIONADO_FINAL: false
    }
  ]);
  const runtime = createAppsScriptRuntime(options);
  assert.equal(runtime.queries.getRotationBefore('ALU-001', 'A'), 1);
});

test('RUNTIME_MISSING_LOCK_FAIL_CLOSED_TEST requires runtime lock', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions({ lock: null })), /RUNTIME_LOCK_REQUIRED/);
});

test('RUNTIME_NO_REAL_EXTERNAL_CALL_TEST does not call real adapters during construction', () => {
  let calls = 0;
  createAppsScriptRuntime(runtimeOptions({ mailAdapter: { send() { calls += 1; } } }));
  assert.equal(calls, 0);
});

test('TRIGGER_EXPIRED_ABSENCE_IDEMPOTENCY_TEST summarizes expired absence handler', () => {
  let calls = 0;
  const handlers = createTriggerHandlers({ commands: { resolveExpiredAbsences() { calls += 1; return calls === 1 ? [{ attendance: {} }] : []; } } });
  assert.deepEqual(handlers.expirePendingAbsences(), { processed: 1, succeeded: 1, failed: 0 });
  assert.deepEqual(handlers.expirePendingAbsences(), { processed: 0, succeeded: 0, failed: 0 });
});

test('TRIGGER_COMMUNICATION_IDEMPOTENCY_TEST summarizes pending communications once', () => {
  const handlers = createTriggerHandlers({ commands: { sendPendingCommunications() { return [{ ok: true }, { ok: false }]; } } });
  assert.deepEqual(handlers.sendPendingCommunications(), { processed: 2, succeeded: 1, failed: 1 });
});

test('TRIGGER_PII_FREE_SUMMARY_TEST returns counts only', () => {
  const result = createTriggerHandlers({ commands: { sendPendingCommunications() { return [{ ok: false, email: 'family@example.invalid' }]; } } }).sendPendingCommunications();
  assert.deepEqual(Object.keys(result).sort(), ['failed', 'processed', 'succeeded']);
});

test('TRIGGER_COMMAND_AUTHORITY_REQUIRED_TEST fails closed without commands', () => {
  const handlers = createTriggerHandlers({});
  assert.throws(() => handlers.expirePendingAbsences(), /TRIGGER_COMMAND_REQUIRED/);
  assert.throws(() => handlers.sendPendingCommunications(), /TRIGGER_COMMAND_REQUIRED/);
});

test('TRIGGER_NO_SERVICE_BYPASS_TEST ignores mutable services fallback', () => {
  const handlers = createTriggerHandlers({ services: { communicationService: { sendPendingCommunications() { return [{ ok: true }]; } } } });
  assert.throws(() => handlers.sendPendingCommunications(), /TRIGGER_COMMAND_REQUIRED/);
});

test('GLOBAL_SETUP_IDEMPOTENCY_TEST creates all operational sheets', () => {
  const spreadsheet = fakeSpreadsheet();
  assert.equal(setupOperationalSheets(spreadsheet, setupSheetWithHeaders).sheetCount, 12);
  assert.equal(setupOperationalSheets(spreadsheet, setupSheetWithHeaders).sheetCount, 12);
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
  const runtime = createAppsScriptRuntime(runtimeOptions());
  assert.equal(runtime.runtime.spreadsheetId, 'test-spreadsheet');
});
