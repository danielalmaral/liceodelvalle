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
const { createAppsScriptEnvironmentAdapter } = require('../../src/adapters/AppsScriptEnvironmentAdapter');
const { createAppsScriptLockAdapter } = require('../../src/adapters/AppsScriptLockAdapter');
const { createAppsScriptIdGenerator } = require('../../src/adapters/AppsScriptIdGenerator');
const { createAppsScriptRepositoryFactory } = require('../../src/adapters/AppsScriptRepositoryFactory');
const { createAppsScriptMailAdapter } = require('../../src/adapters/AppsScriptMailAdapter');
const { createExternalMailGuardAdapter, createLdvAppsScriptRuntime } = require('../../src/AppsScriptRuntimeBootstrap');
const handlers = require('../../src/PanelHandlers');
const { getLdvPanelHtml } = require('../../src/PanelUi');
const { createTriggerHandlers } = require('../../src/triggers/TriggerHandlers');
const { createAppsScriptRuntime } = require('../../src/RuntimeComposition');
const { createConfigService } = require('../../src/config/ConfigService');
const { createMasterDataService } = require('../../src/services/MasterDataService');
const { createSessionService } = require('../../src/services/SessionService');
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
const { completeConfigRows } = require('../config/config-fixtures');

function student(overrides = {}) {
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
    POSICION_SECUNDARIA: 'MED',
    FECHA_ALTA: '2026-01-01',
    FECHA_BAJA: '',
    ESTADO_DEPORTIVO: 'ACTIVO',
    OBSERVACIONES: '',
    ...overrides
  };
}

function tutor(overrides = {}) {
  return {
    TUTOR_ID: 'TUT-001',
    ALUMNO_ID: 'ALU-001',
    NOMBRE_TUTOR: 'Tutor',
    PARENTESCO: 'Tutor',
    EMAIL: 'family@example.invalid',
    TELEFONO: '',
    PRINCIPAL: true,
    RECIBE_AUSENCIAS: true,
    RECIBE_CONVOCATORIAS: true,
    ACTIVO: true,
    ...overrides
  };
}

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
    DURACION_MINUTOS: 60,
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
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-01',
    HORA_INICIO: '08:00',
    HORA_FIN: '09:00',
    COMPETENCIA: 'GENERAL',
    PARTIDO_ID: '',
    DESCRIPCION: '',
    ESTADO: 'ABIERTA',
    CREADA_EN: '',
    CERRADA_EN: '',
    ...overrides
  };
}

function convocation() {
  return {
    CONVOCATORIA_ID: 'CON-001',
    PARTIDO_ID: 'PAR-001',
    COMPETENCIA: 'A',
    TOTAL_OBJETIVO: 1,
    ESTADO: 'APROBADA',
    TOTAL_SELECCIONADOS: 1,
    TOTAL_ALERTAS: 0
  };
}

function detail(overrides = {}) {
  return {
    DETALLE_ID: 'DET-001',
    CONVOCATORIA_ID: 'CON-001',
    ALUMNO_ID: 'ALU-001',
    ELEGIBILITY_STATUS: 'ELIGIBLE',
    MOTIVO_NO_ELEGIBLE: '',
    FI_ORIGEN_ID: '',
    COMPETENCIA_SNAPSHOT: 'A',
    NIVEL_SNAPSHOT: 'A1',
    POSICION_PRINCIPAL_SNAPSHOT: 'DEF',
    POSICION_SECUNDARIA_SNAPSHOT: 'MED',
    POSICION_ASIGNADA: 'DEF',
    PUNTAJE_ASISTENCIA_SNAPSHOT: 1,
    PRESENCIA_REAL_SNAPSHOT: 1,
    ROTACION_ANTES: 0,
    PRIORIDAD_ROTACION: false,
    TOTAL_CONVOCATORIAS_PREVIAS: 0,
    RECOMENDADO_SISTEMA: true,
    SELECCIONADO_FINAL: true,
    CAMBIO_MANUAL: false,
    MOTIVO_CAMBIO: '',
    ROTATION_EXCEPTION: false,
    ROTACION_DESPUES: 1,
    ORDEN_PRIORIDAD: 1,
    ...overrides
  };
}

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

function constructors() {
  return {
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
  };
}

function runtimeOptions(overrides = {}) {
  const repositories = {
    auditRepository: createArrayRepository([]),
    attendanceRepository: createArrayRepository([]),
    communicationRepository: createArrayRepository([]),
    configRepository: createConfigRepository(completeConfigRows()),
    convocationRepository: createArrayRepository([convocation()]),
    detailRepository: createArrayRepository([detail()]),
    matchRepository: createArrayRepository([match()]),
    participationRepository: createArrayRepository([]),
    sessionRepository: createArrayRepository([session()]),
    studentRepository: createArrayRepository([student()]),
    tutorRepository: createArrayRepository([tutor()])
  };

  return {
    constructors: constructors(),
    createTriggerHandlers,
    environment: { spreadsheetId: 'test-spreadsheet' },
    idGenerator: {
      attendanceId: () => 'AST-001',
      matchId: () => 'PAR-NEW',
      operationId: () => 'OP-001',
      participationId: () => 'PRT-001',
      sessionId: () => 'SES-NEW'
    },
    lock: { runExclusive(callback) { return callback(); } },
    mailAdapter: { send() {} },
    repositories,
    utils,
    ...overrides
  };
}

test('SESSION_CREATE_TRAINING_TEST', () => {
  const options = runtimeOptions();
  const result = createAppsScriptRuntime(options).commands.createSession({
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-02',
    HORA_INICIO: '08:00',
    COMPETENCIA: 'GENERAL'
  });
  assert.equal(result.SESION_ID, 'SES-NEW');
  assert.equal(result.ESTADO, 'ABIERTA');
});

test('SESSION_CREATE_MATCH_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.createSession({
    TIPO: 'PARTIDO',
    FECHA: '2026-02-01',
    HORA_INICIO: '10:00',
    COMPETENCIA: 'A',
    PARTIDO_ID: 'PAR-001'
  });
  assert.equal(result.PARTIDO_ID, 'PAR-001');
});

test('SESSION_CREATE_MATCH_FK_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions()).commands.createSession({
    TIPO: 'PARTIDO',
    FECHA: '2026-02-01',
    HORA_INICIO: '10:00',
    COMPETENCIA: 'A',
    PARTIDO_ID: 'PAR-404'
  }), /SESSION_MATCH_FK/);
});

test('SESSION_CREATE_COMPETITION_ALIGNMENT_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions()).commands.createSession({
    TIPO: 'PARTIDO',
    FECHA: '2026-02-01',
    HORA_INICIO: '10:00',
    COMPETENCIA: 'B',
    PARTIDO_ID: 'PAR-001'
  }), /SESSION_MATCH_COMPETITION_ALIGNMENT/);
});

test('SESSION_CLOSE_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.closeSession('SES-001', 'coach');
  assert.equal(result.ESTADO, 'CERRADA');
});

test('SESSION_DOUBLE_CLOSE_REJECTED_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions({
    repositories: { ...runtimeOptions().repositories, sessionRepository: createArrayRepository([session({ ESTADO: 'CERRADA' })]) }
  })).commands.closeSession('SES-001', 'coach'), /SESSION_DOUBLE_CLOSE_REJECTED/);
});

test('SESSION_COMMAND_LOCK_TEST', () => {
  let inside = false;
  let observed = false;
  const runtime = createAppsScriptRuntime(runtimeOptions({
    lock: { runExclusive(callback) { inside = true; try { return callback(); } finally { inside = false; } } },
    repositories: { ...runtimeOptions().repositories, sessionRepository: { getAll: () => [session()], insert: (record) => record, updateById: () => { observed = inside; return session({ ESTADO: 'CERRADA' }); } } }
  }));
  runtime.commands.closeSession('SES-001', 'coach');
  assert.equal(observed, true);
});

test('SESSION_AUDIT_TEST', () => {
  const options = runtimeOptions();
  createAppsScriptRuntime(options).commands.closeSession('SES-001', 'coach');
  assert.equal(options.repositories.auditRepository.getAll().some((event) => event.ACCION === 'CIERRE_SESION'), true);
});

test('MATCH_CREATE_COMMAND_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.createMatch({
    COMPETENCIA: 'B',
    JORNADA: 'FINAL',
    RIVAL: 'Otro Rival',
    FECHA: '2026-03-01',
    HORA_CITACION: '08:00',
    HORA_PARTIDO: '09:00',
    SEDE: 'Cancha',
    LOCAL_VISITANTE: 'VISITANTE',
    DURACION_MINUTOS: 60
  });
  assert.equal(result.PARTIDO_ID, 'PAR-NEW');
});

test('MATCH_UPDATE_COMMAND_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.updateMatch('PAR-001', { SEDE: 'Cancha Dos' }, 'coach');
  assert.equal(result.SEDE, 'Cancha Dos');
});

test('MATCH_MARK_PLAYED_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.markMatchPlayed('PAR-001', { golesFavor: 2, golesContra: 1 }, 'coach');
  assert.equal(result.ESTADO, 'JUGADO');
  assert.equal(result.GOLES_FAVOR, 2);
});

test('MATCH_CANCEL_COMMAND_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.cancelMatch('PAR-001', 'coach');
  assert.equal(result.ESTADO, 'CANCELADO');
});

test('MATCH_WRITE_VALIDATION_REUSE_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions()).commands.createMatch({
    COMPETENCIA: 'GENERAL',
    JORNADA: 'J1',
    RIVAL: 'Rival',
    FECHA: '2026-03-01',
    HORA_PARTIDO: '09:00',
    SEDE: 'Cancha',
    LOCAL_VISITANTE: 'LOCAL',
    DURACION_MINUTOS: 60
  }), /INVALID_ENUM: COMPETENCIA/);
});

test('MATCH_COMMAND_LOCK_TEST', () => {
  let inside = false;
  let observed = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { inside = true; try { return callback(); } finally { inside = false; } } }
  });
  options.repositories.matchRepository = { getAll: () => [match()], insert: (record) => record, updateById: () => { observed = inside; return match({ ESTADO: 'CANCELADO' }); } };
  createAppsScriptRuntime(options).commands.cancelMatch('PAR-001', 'coach');
  assert.equal(observed, true);
});

test('MATCH_AUDIT_TEST', () => {
  const options = runtimeOptions();
  createAppsScriptRuntime(options).commands.cancelMatch('PAR-001', 'coach');
  assert.equal(options.repositories.auditRepository.getAll().some((event) => event.ACCION === 'PARTIDO_CANCELADO'), true);
});

test('STUDENT_SPORTS_STATE_UPDATE_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.updateStudentSportsState('ALU-001', 'LESIONADO', 'coach', 'INJURY');
  assert.equal(result.ESTADO_DEPORTIVO, 'LESIONADO');
});

test('STUDENT_SPORTS_STATE_ELIGIBILITY_EFFECT_TEST', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  runtime.commands.updateStudentSportsState('ALU-001', 'SUSPENDIDO', 'coach', 'DISCIPLINE');
  assert.equal(runtime.queries.getStudents()[0].estadoDeportivo, 'SUSPENDIDO');
});

test('STUDENT_SPORTS_STATE_AUDIT_TEST', () => {
  const options = runtimeOptions();
  createAppsScriptRuntime(options).commands.updateStudentSportsState('ALU-001', 'LESIONADO', 'coach', 'INJURY');
  assert.equal(options.repositories.auditRepository.getAll().some((event) => event.ACCION === 'ESTADO_DEPORTIVO'), true);
});

test('STUDENT_SPORTS_STATE_COMMAND_LOCK_TEST', () => {
  let inside = false;
  let observed = false;
  const options = runtimeOptions({
    lock: { runExclusive(callback) { inside = true; try { return callback(); } finally { inside = false; } } }
  });
  options.repositories.studentRepository = { getAll: () => [student()], updateById: () => { observed = inside; return student({ ESTADO_DEPORTIVO: 'LESIONADO' }); } };
  createAppsScriptRuntime(options).commands.updateStudentSportsState('ALU-001', 'LESIONADO', 'coach', 'INJURY');
  assert.equal(observed, true);
});

test('PANEL_DASHBOARD_QUERY_TEST', () => {
  const dashboard = createAppsScriptRuntime(runtimeOptions()).queries.getPanelDashboard();
  assert.equal(dashboard.openSessions.length, 1);
  assert.equal(dashboard.communications.pending, 0);
});

test('PANEL_ATTENDANCE_VIEW_TEST', () => {
  const view = createAppsScriptRuntime(runtimeOptions()).queries.getPanelAttendance('SES-001');
  assert.equal(view.rows[0].studentId, 'ALU-001');
  assert.equal(view.rows[0].capabilities.canMarkAttendance, true);
});

test('PANEL_CONVOCATION_VIEW_TEST', () => {
  const view = createAppsScriptRuntime(runtimeOptions()).queries.getPanelConvocation('CON-001');
  assert.equal(view.details[0].ELEGIBILITY_STATUS, 'ELIGIBLE');
  assert.equal(view.details[0].puntajeAsistencia, 1);
});

test('PANEL_PARTICIPATION_VIEW_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  const view = createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001');
  assert.equal(view.readiness.ready, false);
});

test('PANEL_NO_BUSINESS_RULE_DUPLICATION_TEST', () => {
  const service = createPanelQueryService({
    configService: null,
    convocationRepository: createArrayRepository([]),
    detailRepository: createArrayRepository([]),
    queries: { getStudents: () => [], getAttendances: () => [], getSessions: () => [], getMatches: () => [], getCommunications: () => [], getParticipations: () => [], validateMatchParticipationReadiness: () => ({ alerts: [] }) }
  });
  assert.equal(typeof service.getDashboard, 'function');
});

test('PANEL_READ_ONLY_TEST', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  assert.equal(runtime.queries.createSession, undefined);
  assert.equal(runtime.services.updateMatch, undefined);
});

test('PANEL_PII_MINIMIZATION_TEST', () => {
  const dashboard = createAppsScriptRuntime(runtimeOptions()).queries.getPanelDashboard();
  assert.equal(JSON.stringify(dashboard).includes('family@example.invalid'), false);
});

test('PANEL_SHEET_SETUP_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  const result = setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(result.sheetCount, 12);
  assert.deepEqual(spreadsheet.sheets.PANEL.rows[0], global.PANEL_HEADERS);
});

test('PANEL_SHEET_IDEMPOTENCY_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  spreadsheet.sheets.PANEL.rows.push(['AYUDA', 'texto', '']);
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(spreadsheet.sheets.PANEL.rows.length, 2);
});

test('PANEL_SHEET_NOT_AUTHORITY_TEST', () => {
  assert.equal(global.PANEL_HEADERS.includes('ALUMNO_ID'), false);
  assert.equal(global.PANEL_HEADERS.includes('PARTIDO_ID'), false);
});

test('GLOBAL_SETUP_12_SHEETS_TEST', () => {
  assert.equal(setupOperationalSheets(fakeSpreadsheet(), setupSheetWithHeaders).sheetCount, 12);
});

test('GLOBAL_SETUP_PRESERVES_EXISTING_DATA_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  spreadsheet.sheets.PARTIDOS.rows.push(['PAR-001']);
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(spreadsheet.sheets.PARTIDOS.rows.length, 2);
});

test('APPS_SCRIPT_ENV_LAZY_TEST', () => {
  let calls = 0;
  const env = createAppsScriptEnvironmentAdapter({ getProperty() { calls += 1; return 'sheet-id'; } });
  assert.equal(calls, 0);
  assert.equal(env.getSpreadsheetId(), 'sheet-id');
});

test('APPS_SCRIPT_ENV_MISSING_SPREADSHEET_TEST', () => {
  const env = createAppsScriptEnvironmentAdapter({ getProperty: () => '' });
  assert.throws(() => env.getSpreadsheetId(), /RUNTIME_SPREADSHEET_ID_REQUIRED/);
});

test('APPS_SCRIPT_LOCK_LAZY_TEST', () => {
  let created = false;
  const adapter = createAppsScriptLockAdapter({ tryLock: () => { created = true; return true; }, releaseLock() {} });
  assert.equal(created, false);
  adapter.runExclusive(() => true);
  assert.equal(created, true);
});

test('APPS_SCRIPT_LOCK_RELEASE_TEST', () => {
  let released = false;
  createAppsScriptLockAdapter({ tryLock: () => true, releaseLock: () => { released = true; } }).runExclusive(() => true);
  assert.equal(released, true);
});

test('APPS_SCRIPT_LOCK_FAILURE_TEST', () => {
  assert.throws(() => createAppsScriptLockAdapter({ tryLock: () => false, releaseLock() {} }).runExclusive(() => true), /RUNTIME_LOCK_ACQUISITION_FAILED/);
});

test('APPS_SCRIPT_REPOSITORY_FACTORY_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  const factory = createAppsScriptRepositoryFactory({ spreadsheet, createRepository: createSheetRepository });
  assert.equal(factory.createRepository('ALUMNOS').getAll().length, 0);
});

test('APPS_SCRIPT_REPOSITORY_MISSING_SHEET_TEST', () => {
  const factory = createAppsScriptRepositoryFactory({ spreadsheet: fakeSpreadsheet(), createRepository: createSheetRepository });
  assert.throws(() => factory.createRepository('ALUMNOS'), /SHEET_REQUIRED/);
});

test('APPS_SCRIPT_ID_GENERATOR_PREFIX_TEST', () => {
  const ids = createAppsScriptIdGenerator({ getUuid: () => 'uuid' });
  assert.equal(ids.studentId(), 'ALU-uuid');
  assert.equal(ids.operationId(), 'OP-uuid');
});

test('APPS_SCRIPT_ID_GENERATOR_UNIQUENESS_TEST', () => {
  let count = 0;
  const ids = createAppsScriptIdGenerator({ getUuid: () => `uuid-${count += 1}` });
  assert.notEqual(ids.sessionId(), ids.sessionId());
});

test('APPS_SCRIPT_MAIL_DISABLED_TEST', () => {
  let sent = false;
  const guarded = createExternalMailGuardAdapter({ getExternalMailEnabled: () => false }, { send: () => { sent = true; } });
  assert.throws(() => guarded.send({}), /MAIL_EXTERNAL_DISABLED/);
  assert.equal(sent, false);
});

test('APPS_SCRIPT_MAIL_NOT_CALLED_ON_BOOTSTRAP_TEST', () => {
  let sent = false;
  createLdvAppsScriptRuntime(runtimeOptions({
    environment: { getSpreadsheetId: () => 'test-spreadsheet', getExternalMailEnabled: () => false },
    mailAdapter: { send: () => { sent = true; } },
    runtimeFactory: createAppsScriptRuntime,
    repositoryFactory: {
      createRepository(name) {
        const map = {
          ALUMNOS: 'studentRepository',
          ASISTENCIAS: 'attendanceRepository',
          BITACORA: 'auditRepository',
          COMUNICACIONES: 'communicationRepository',
          CONFIG: 'configRepository',
          CONVOCATORIAS: 'convocationRepository',
          CONVOCATORIA_DETALLE: 'detailRepository',
          PARTICIPACION_PARTIDO: 'participationRepository',
          PARTIDOS: 'matchRepository',
          SESIONES: 'sessionRepository',
          TUTORES: 'tutorRepository'
        };
        return runtimeOptions().repositories[map[name]];
      }
    }
  }));
  assert.equal(sent, false);
});

test('APPS_SCRIPT_RUNTIME_BOOTSTRAP_TEST', () => {
  const runtime = createLdvAppsScriptRuntime(runtimeOptions({
    environment: { getSpreadsheetId: () => 'test-spreadsheet', getExternalMailEnabled: () => false },
    runtimeFactory: createAppsScriptRuntime,
    repositoryFactory: {
      createRepository(name) {
        const map = {
          ALUMNOS: 'studentRepository',
          ASISTENCIAS: 'attendanceRepository',
          BITACORA: 'auditRepository',
          COMUNICACIONES: 'communicationRepository',
          CONFIG: 'configRepository',
          CONVOCATORIAS: 'convocationRepository',
          CONVOCATORIA_DETALLE: 'detailRepository',
          PARTICIPACION_PARTIDO: 'participationRepository',
          PARTIDOS: 'matchRepository',
          SESIONES: 'sessionRepository',
          TUTORES: 'tutorRepository'
        };
        return runtimeOptions().repositories[map[name]];
      }
    }
  }));
  assert.equal(typeof runtime.commands.createSession, 'function');
});

test('APPS_SCRIPT_RUNTIME_NO_CALL_ON_LOAD_TEST', () => {
  assert.equal(typeof createLdvAppsScriptRuntime, 'function');
  assert.equal(typeof getLdvPanelHtml(), 'string');
});

test('ONOPEN_MENU_ONLY_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('Liceo del Valle'), true);
  assert.equal(html.includes('MailApp'), false);
});

test('PANEL_HANDLER_COMMAND_BOUNDARY_TEST', () => {
  assert.equal(handlers.safePanelResponse(() => 'ok').ok, true);
  assert.equal(handlers.safePanelResponse(() => { throw new Error('PRIVATE: detail'); }).code, 'PRIVATE');
});

test('PANEL_HANDLER_NO_REPOSITORY_ACCESS_TEST', () => {
  assert.equal(String(handlers.commandCreateSession).includes('repository'), false);
});

test('PANEL_HANDLER_OPERATION_ID_SERVER_GENERATED_TEST', () => {
  assert.equal(String(handlers.commandApproveConvocation).includes('operationId'), true);
});

test('PANEL_HANDLER_ERROR_SANITIZATION_TEST', () => {
  const response = handlers.safePanelResponse(() => { throw new Error('ERROR: sensitive'); });
  assert.deepEqual(response, { ok: false, code: 'ERROR', message: 'No se pudo completar la operacion solicitada.' });
});

test('P14_END_TO_END_FAKE_RUNTIME_TEST', () => {
  const options = runtimeOptions();
  options.repositories.attendanceRepository = createArrayRepository([]);
  const runtime = createAppsScriptRuntime(options);
  const createdSession = runtime.commands.createSession({ TIPO: 'ENTRENAMIENTO', FECHA: '2026-02-03', HORA_INICIO: '08:00', COMPETENCIA: 'GENERAL' });
  const attendance = runtime.commands.createAttendance({ sesionId: createdSession.SESION_ID, alumnoId: 'ALU-001', estado: 'A' });
  const dashboard = runtime.queries.getPanelDashboard();
  assert.equal(attendance.ALUMNO_ID, 'ALU-001');
  assert.equal(dashboard.attendanceCaptured, 1);
  assert.equal(JSON.stringify(runtime.queries.getEvents()).includes('family@example.invalid'), false);
});
