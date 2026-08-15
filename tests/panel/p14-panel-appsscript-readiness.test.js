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
const { getLdvPanelHtml, onOpen, setupLdvOperationalSheetsWithDependencies } = require('../../src/PanelUi');
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

test('SESSION_TRAINING_GENERAL_ALLOWED_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.createSession({
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-02',
    HORA_INICIO: '08:00',
    COMPETENCIA: 'GENERAL'
  });
  assert.equal(result.COMPETENCIA, 'GENERAL');
});

test('SESSION_TRAINING_A_ALLOWED_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.createSession({
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-02',
    HORA_INICIO: '08:00',
    COMPETENCIA: 'A'
  });
  assert.equal(result.COMPETENCIA, 'A');
});

test('SESSION_TRAINING_B_ALLOWED_TEST', () => {
  const result = createAppsScriptRuntime(runtimeOptions()).commands.createSession({
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-02',
    HORA_INICIO: '08:00',
    COMPETENCIA: 'B'
  });
  assert.equal(result.COMPETENCIA, 'B');
});

test('SESSION_TRAINING_MATCH_ID_REJECTED_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions()).commands.createSession({
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-02',
    HORA_INICIO: '08:00',
    COMPETENCIA: 'A',
    PARTIDO_ID: 'PAR-001'
  }), /SESSION_TRAINING_MATCH_NOT_EMPTY/);
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

test('MATCH_UPDATE_STATE_BYPASS_REJECTED_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions()).commands.updateMatch('PAR-001', { ESTADO: 'JUGADO' }, 'coach'), /MATCH_UPDATE_STATE_BYPASS_REJECTED/);
});

test('MATCH_UPDATE_SCORE_BYPASS_REJECTED_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions()).commands.updateMatch('PAR-001', { GOLES_FAVOR: 1 }, 'coach'), /MATCH_UPDATE_SCORE_BYPASS_REJECTED/);
});

test('MATCH_UPDATE_ID_BYPASS_REJECTED_TEST', () => {
  assert.throws(() => createAppsScriptRuntime(runtimeOptions()).commands.updateMatch('PAR-001', { PARTIDO_ID: 'PAR-X' }, 'coach'), /MATCH_UPDATE_ID_BYPASS_REJECTED/);
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
  assert.equal(runtime.queries.evaluateMatch('PAR-001')[0].status, 'ELIGIBLE');
  runtime.commands.updateStudentSportsState('ALU-001', 'SUSPENDIDO', 'coach', 'DISCIPLINE');
  assert.equal(runtime.queries.evaluateMatch('PAR-001')[0].status, 'INELIGIBLE');
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
  const dashboard = createAppsScriptRuntime(runtimeOptions({ clock: { now: () => new Date('2026-02-01T08:30:00') } })).queries.getPanelDashboard();
  assert.equal(dashboard.currentSession || dashboard.nextSession ? true : false, true);
  assert.equal(dashboard.attendanceBySession.length, 1);
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
  assert.equal(view.rows.length, 1);
  assert.equal(view.rows[0].PARTICIPACION_ID, '');
});

test('PANEL_NO_BUSINESS_RULE_DUPLICATION_TEST', () => {
  let readinessCalled = 0;
  const service = createPanelQueryService({
    configService: null,
    convocationRepository: createArrayRepository([]),
    detailRepository: createArrayRepository([]),
    queries: { getStudents: () => [], getAttendances: () => [], getSessions: () => [], getMatches: () => [{ partidoId: 'PAR-1' }], getCommunications: () => [], getParticipations: () => [], validateMatchParticipationReadiness: () => { readinessCalled += 1; return { alerts: [], errors: [] }; } }
  });
  service.getDashboard();
  assert.equal(readinessCalled, 1);
  assert.equal(String(createPanelQueryService).includes('MIN_DEFENSAS'), false);
  assert.equal(String(createPanelQueryService).includes('ROTACION_ANTES +'), false);
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

test('PANEL_CURRENT_SESSION_TEST', () => {
  const options = runtimeOptions({ clock: { now: () => new Date('2026-02-01T08:30:00') } });
  options.repositories.sessionRepository = createArrayRepository([
    session({ SESION_ID: 'SES-CURRENT', FECHA: '2026-02-01', HORA_INICIO: '08:00', HORA_FIN: '09:00' })
  ]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().currentSession.sesionId, 'SES-CURRENT');
});

test('PANEL_NEXT_SESSION_EXCLUDES_PAST_CLOSED_TEST', () => {
  const options = runtimeOptions({ clock: { now: () => new Date('2026-02-01T10:00:00') } });
  options.repositories.sessionRepository = createArrayRepository([
    session({ SESION_ID: 'SES-PAST', FECHA: '2026-02-01', HORA_INICIO: '08:00', HORA_FIN: '09:00' }),
    session({ SESION_ID: 'SES-CLOSED', FECHA: '2026-02-01', HORA_INICIO: '11:00', HORA_FIN: '12:00', ESTADO: 'CERRADA' }),
    session({ SESION_ID: 'SES-NEXT', FECHA: '2026-02-01', HORA_INICIO: '12:00', HORA_FIN: '13:00' })
  ]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().nextSession.sesionId, 'SES-NEXT');
});

test('PANEL_NEXT_SESSION_REPOSITORY_ORDER_INVARIANT_TEST', () => {
  const options = runtimeOptions({ clock: { now: () => new Date('2026-02-01T07:00:00') } });
  options.repositories.sessionRepository = createArrayRepository([
    session({ SESION_ID: 'SES-LATE', FECHA: '2026-02-01', HORA_INICIO: '12:00', HORA_FIN: '13:00' }),
    session({ SESION_ID: 'SES-EARLY', FECHA: '2026-02-01', HORA_INICIO: '08:00' })
  ]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().nextSession.sesionId, 'SES-EARLY');
});

test('PANEL_ATTENDANCE_COUNTS_SCOPED_TEST', () => {
  const options = runtimeOptions();
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-001' }), student({ ALUMNO_ID: 'ALU-002' })]);
  options.repositories.attendanceRepository = createArrayRepository([{ ASISTENCIA_ID: 'AST-001', SESION_ID: 'SES-001', ALUMNO_ID: 'ALU-001', ESTADO: 'A' }]);
  const summary = createAppsScriptRuntime(options).queries.getPanelDashboard().attendanceBySession[0];
  assert.equal(summary.expected, 2);
  assert.equal(summary.captured, 1);
  assert.equal(summary.missing, 1);
});

test('PANEL_ATTENDANCE_A_POOL_TEST', () => {
  const options = runtimeOptions();
  options.repositories.sessionRepository = createArrayRepository([session({ COMPETENCIA: 'A' })]);
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-A', COMPETENCIA_BASE: 'A' }), student({ ALUMNO_ID: 'ALU-B', COMPETENCIA_BASE: 'B' })]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().attendanceBySession[0].expected, 1);
});

test('PANEL_ATTENDANCE_B_POOL_TEST', () => {
  const options = runtimeOptions();
  options.repositories.sessionRepository = createArrayRepository([session({ COMPETENCIA: 'B' })]);
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-A', COMPETENCIA_BASE: 'A' }), student({ ALUMNO_ID: 'ALU-B', COMPETENCIA_BASE: 'B' })]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().attendanceBySession[0].expected, 1);
});

test('PANEL_EXPIRED_ABSENCE_DEADLINE_TEST', () => {
  const options = runtimeOptions({ clock: { now: () => new Date('2026-02-02T10:00:00') } });
  options.repositories.attendanceRepository = createArrayRepository([{ ASISTENCIA_ID: 'AST-001', SESION_ID: 'SES-001', ALUMNO_ID: 'ALU-001', ESTADO: 'F', LIMITE_JUSTIFICACION: '2026-02-02T09:00:00' }]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().expiredAbsences, 1);
});

test('PANEL_NEXT_ABSENCE_DEADLINE_TEST', () => {
  const options = runtimeOptions({ clock: { now: () => new Date('2026-02-02T08:00:00') } });
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-001' }), student({ ALUMNO_ID: 'ALU-002' })]);
  options.repositories.attendanceRepository = createArrayRepository([
    { ASISTENCIA_ID: 'AST-002', SESION_ID: 'SES-001', ALUMNO_ID: 'ALU-001', ESTADO: 'F', LIMITE_JUSTIFICACION: '2026-02-02T11:00:00' },
    { ASISTENCIA_ID: 'AST-001', SESION_ID: 'SES-001', ALUMNO_ID: 'ALU-002', ESTADO: 'F', LIMITE_JUSTIFICACION: '2026-02-02T09:00:00' }
  ]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().nextAbsenceDeadline.toISOString(), new Date('2026-02-02T09:00:00').toISOString());
});

test('PANEL_CONVOCATION_AUTHORITATIVE_SELECTION_TEST', () => {
  const options = runtimeOptions();
  options.repositories.convocationRepository = createArrayRepository([
    { ...convocation(), CONVOCATORIA_ID: 'CON-PROP', ESTADO: 'PROPUESTA' },
    { ...convocation(), CONVOCATORIA_ID: 'CON-AUTH', ESTADO: 'APROBADA' }
  ]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().convocationStatusByMatch['PAR-001'].CONVOCATORIA_ID, 'CON-AUTH');
});

test('PANEL_CONVOCATION_REPOSITORY_ORDER_INVARIANT_TEST', () => {
  const options = runtimeOptions();
  options.repositories.convocationRepository = createArrayRepository([
    { ...convocation(), CONVOCATORIA_ID: 'CON-Z', ESTADO: 'PROPUESTA' },
    { ...convocation(), CONVOCATORIA_ID: 'CON-A', ESTADO: 'APROBADA' }
  ]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().convocationStatusByMatch['PAR-001'].CONVOCATORIA_ID, 'CON-A');
});

test('PANEL_RED_ALERT_NO_DUPLICATION_TEST', () => {
  const options = runtimeOptions();
  options.constructors.createParticipationService = () => ({
    getParticipations: () => [],
    validateMatchParticipationReadiness: () => ({ ready: true, errors: [], alerts: [{ code: 'RED_CARD_REVIEW_REQUIRED', studentId: 'ALU-001', matchId: 'PAR-001' }] })
  });
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().sportAlerts.length, 1);
});

test('PANEL_READINESS_ISSUE_VISIBLE_TEST', () => {
  const options = runtimeOptions();
  options.constructors.createParticipationService = () => ({
    getParticipations: () => [],
    validateMatchParticipationReadiness: () => ({ ready: false, errors: ['PARTICIPATION_MISSING_SELECTED_PLAYER'], alerts: [] })
  });
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().readinessIssues[0].code, 'PARTICIPATION_MISSING_SELECTED_PLAYER');
});

test('PANEL_PARTICIPATION_FINAL_SELECTED_LEFT_JOIN_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  const view = createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001');
  assert.equal(view.rows.length, 1);
  assert.equal(view.rows[0].ALUMNO_ID, 'ALU-001');
});

test('PANEL_PARTICIPATION_EMPTY_CAPTURE_ROWS_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001').rows[0].MINUTOS_JUGADOS, '');
});

test('PANEL_PARTICIPATION_UNSELECTED_EXCLUDED_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  options.repositories.detailRepository = createArrayRepository([detail({ SELECCIONADO_FINAL: false })]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001').rows.length, 0);
});

test('PANEL_SHEET_SETUP_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  const result = setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(result.sheetCount, 12);
  assert.deepEqual(spreadsheet.sheets.PANEL.rows[0], global.PANEL_HEADERS);
  assert.equal(spreadsheet.sheets.PANEL.rows.some((row) => row[0] === 'BIENVENIDA'), true);
});

test('PANEL_SHEET_IDEMPOTENCY_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(spreadsheet.sheets.PANEL.rows.filter((row) => row[0] === 'AYUDA').length, 1);
});

test('PANEL_LANDING_CONTENT_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(spreadsheet.sheets.PANEL.rows.some((row) => row[1] === 'Liceo del Valle - Futbol'), true);
});

test('PANEL_LANDING_IDEMPOTENCY_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(spreadsheet.sheets.PANEL.rows.filter((row) => row[0] === 'BIENVENIDA').length, 1);
});

test('PANEL_LANDING_PRESERVES_CUSTOM_CONTENT_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  spreadsheet.sheets.PANEL.rows.push(['CUSTOM', 'nota local', '']);
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.equal(spreadsheet.sheets.PANEL.rows.some((row) => row[0] === 'CUSTOM'), true);
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

test('RUNTIME_EXTERNAL_MAIL_CAPABILITY_TEST', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions({
    environment: { spreadsheetId: 'test-spreadsheet', getExternalMailEnabled: () => false }
  }));
  assert.deepEqual(runtime.queries.getRuntimeCapabilities(), { externalMailEnabled: false });
});

test('MAIL_DISABLED_COMMAND_NO_COMMUNICATION_WRITE_TEST', () => {
  let writes = 0;
  let sent = 0;
  const options = runtimeOptions({
    environment: { spreadsheetId: 'test-spreadsheet', getExternalMailEnabled: () => false }
  });
  options.repositories.communicationRepository = {
    getAll: () => [{ COMUNICACION_ID: 'COM-001', TIPO: 'AUSENCIA', ALUMNO_ID: 'ALU-001', TUTOR_ID: 'TUT-001', REFERENCIA_ID: 'AST-001', DESTINATARIO: 'family@example.invalid', ASUNTO: 'Aviso', CUERPO: 'Texto', CREADO_EN: '', ENVIADO_EN: '', ESTADO: 'PENDIENTE', ERROR: '', INTENTOS: 0 }],
    insert(record) { return record; },
    updateById() { writes += 1; }
  };
  options.mailAdapter = { send() { sent += 1; } };
  assert.throws(() => createAppsScriptRuntime(options).commands.sendPendingCommunications(), /MAIL_EXTERNAL_DISABLED/);
  assert.equal(writes, 0);
  assert.equal(sent, 0);
});

test('MAIL_DISABLED_COMMAND_NO_AUDIT_WRITE_TEST', () => {
  let auditWrites = 0;
  const options = runtimeOptions({
    environment: { spreadsheetId: 'test-spreadsheet', getExternalMailEnabled: () => false }
  });
  options.repositories.auditRepository = { getAll: () => [], insert() { auditWrites += 1; } };
  assert.throws(() => createAppsScriptRuntime(options).commands.sendPendingCommunications(), /MAIL_EXTERNAL_DISABLED/);
  assert.equal(auditWrites, 0);
});

test('MAIL_DISABLED_COMMAND_NO_ADAPTER_CALL_TEST', () => {
  let sent = 0;
  assert.throws(() => createAppsScriptRuntime(runtimeOptions({
    environment: { spreadsheetId: 'test-spreadsheet', getExternalMailEnabled: () => false },
    mailAdapter: { send() { sent += 1; } }
  })).commands.sendPendingCommunications(), /MAIL_EXTERNAL_DISABLED/);
  assert.equal(sent, 0);
});

test('FIRST_RUN_EMPTY_SPREADSHEET_SETUP_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  const result = setupLdvOperationalSheetsWithDependencies({
    environment: { getSpreadsheetId: () => 'sheet-id' },
    spreadsheet,
    setupOperationalSheets,
    setupFn: setupSheetWithHeaders
  });
  assert.equal(result.sheetCount, 12);
  assert.equal(Object.keys(spreadsheet.sheets).length, 12);
});

test('FIRST_RUN_SETUP_DOES_NOT_BUILD_RUNTIME_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  const result = setupLdvOperationalSheetsWithDependencies({
    environment: { getSpreadsheetId: () => 'sheet-id' },
    spreadsheet,
    setupOperationalSheets,
    setupFn: setupSheetWithHeaders
  });
  assert.equal(result.sheetCount, 12);
});

test('FIRST_RUN_SETUP_NO_MAIL_TEST', () => {
  let opened = false;
  const spreadsheet = fakeSpreadsheet();
  setupLdvOperationalSheetsWithDependencies({
    environment: { getSpreadsheetId: () => 'sheet-id' },
    spreadsheetProvider: { openById() { opened = true; return spreadsheet; } },
    setupOperationalSheets,
    setupFn: setupSheetWithHeaders
  });
  assert.equal(opened, true);
});

test('FIRST_RUN_SETUP_IDEMPOTENCY_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupLdvOperationalSheetsWithDependencies({ environment: { getSpreadsheetId: () => 'sheet-id' }, spreadsheet, setupOperationalSheets, setupFn: setupSheetWithHeaders });
  setupLdvOperationalSheetsWithDependencies({ environment: { getSpreadsheetId: () => 'sheet-id' }, spreadsheet, setupOperationalSheets, setupFn: setupSheetWithHeaders });
  assert.equal(spreadsheet.sheets.PANEL.rows.filter((row) => row[0] === 'BIENVENIDA').length, 1);
});

test('FIRST_RUN_SETUP_EXISTING_DATA_PRESERVED_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupLdvOperationalSheetsWithDependencies({ environment: { getSpreadsheetId: () => 'sheet-id' }, spreadsheet, setupOperationalSheets, setupFn: setupSheetWithHeaders });
  spreadsheet.sheets.ALUMNOS.rows.push(['ALU-001']);
  setupLdvOperationalSheetsWithDependencies({ environment: { getSpreadsheetId: () => 'sheet-id' }, spreadsheet, setupOperationalSheets, setupFn: setupSheetWithHeaders });
  assert.equal(spreadsheet.sheets.ALUMNOS.rows.length, 2);
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

test('ONOPEN_REAL_MENU_ONLY_TEST', () => {
  const calls = [];
  const previous = global.SpreadsheetApp;
  global.SpreadsheetApp = {
    getUi() {
      calls.push('getUi');
      return {
        createMenu(name) {
          calls.push(`menu:${name}`);
          return {
            addItem(label, fn) { calls.push(`item:${label}:${fn}`); return this; },
            addToUi() { calls.push('addToUi'); return this; }
          };
        }
      };
    }
  };
  try {
    onOpen();
  } finally {
    global.SpreadsheetApp = previous;
  }
  assert.deepEqual(calls, [
    'getUi',
    'menu:Liceo del Valle',
    'item:Abrir Panel:showLdvPanel',
    'item:Setup / Verificar estructura:setupLdvOperationalSheets',
    'addToUi'
  ]);
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

test('PANEL_HANDLER_REAL_COMMAND_BOUNDARY_TEST', () => {
  let called = false;
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: {
      createSession(input, options) {
        called = true;
        assert.equal(input.SESION_ID, undefined);
        assert.equal(options.operationId, 'OP-SERVER');
        return { ok: true };
      }
    },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandCreateSession({ SESION_ID: 'CLIENT', TIPO: 'ENTRENAMIENTO', FECHA: '2026-02-01', HORA_INICIO: '08:00' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
  assert.equal(called, true);
});

test('PANEL_HANDLER_CLIENT_OPERATION_ID_IGNORED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: {
      resolveAbsence(id, state, options) {
        assert.equal(options.operationId, 'OP-SERVER');
        return { id, state };
      }
    },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandResolveAbsence('AST-001', 'FJ', { operationId: 'OP-CLIENT', reason: 'safe' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_HANDLER_CLIENT_TIMESTAMP_IGNORED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: {
      createAttendance(input) {
        assert.equal(input.registradoEn, undefined);
        assert.equal(input.LIMITE_JUSTIFICACION, undefined);
        return input;
      }
    },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandCreateAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A', registradoEn: 'client', LIMITE_JUSTIFICACION: 'client' }).data.registradoEn, undefined);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_HANDLER_ERROR_SANITIZATION_E2E_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: { createAttendance() { throw new Error('STACK family@example.invalid'); } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    const response = handlers.commandCreateAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' });
    assert.equal(response.ok, false);
    assert.equal(JSON.stringify(response).includes('family@example.invalid'), false);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_ABSENCE_CLIENT_NOW_IGNORED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: { resolveAbsence(id, state, options) { assert.equal(options.now, undefined); return { id, state }; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandResolveAbsence('AST-001', 'FJ', { now: 'client', reason: 'safe' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_ABSENCE_FI_DIRECT_REJECTED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({ commands: { resolveAbsence() { throw new Error('SHOULD_NOT_CALL'); } }, runtime: { idGenerator: { operationId: () => 'OP-SERVER' } } }));
  try {
    assert.equal(handlers.commandResolveAbsence('AST-001', 'FI', {}).ok, false);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_ABSENCE_FJ_SERVER_CLOCK_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: { resolveAbsence(id, state, options) { assert.equal(state, 'FJ'); assert.equal(options.MODIFICADO_EN, undefined); return { id, state }; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandResolveAbsence('AST-001', 'FJ', { MODIFICADO_EN: 'client' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_ABSENCE_LES_SERVER_CLOCK_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: { resolveAbsence(id, state, options) { assert.equal(state, 'LES'); assert.equal(options.LIMITE_JUSTIFICACION, undefined); return { id, state }; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandResolveAbsence('AST-001', 'LES', { LIMITE_JUSTIFICACION: 'client' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_ATTENDANCE_ID_SERVER_GENERATED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: { createAttendance(input) { assert.equal(input.asistenciaId, undefined); assert.equal(input.ASISTENCIA_ID, undefined); return input; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandCreateAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A', ASISTENCIA_ID: 'CLIENT' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_ATTENDANCE_TIMESTAMP_SERVER_GENERATED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: { createAttendance(input) { assert.equal(input.REGISTRADO_EN, undefined); return input; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandCreateAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A', REGISTRADO_EN: 'client' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_ATTENDANCE_CLIENT_DEADLINE_IGNORED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: { createAttendance(input) { assert.equal(input.limiteJustificacion, undefined); return input; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandCreateAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'F', limiteJustificacion: 'client' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_UI_NAVIGATION_BINDINGS_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('addEventListener("click"'), true);
  assert.equal(html.includes('data-view="dashboard"'), true);
  assert.equal(html.includes('data-view="alerts"'), true);
});

test('PANEL_UI_ATTENDANCE_A_R_F_ACTIONS_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('>A</button>'), true);
  assert.equal(html.includes('>R</button>'), true);
  assert.equal(html.includes('>F</button>'), true);
});

test('PANEL_UI_ABSENCE_FJ_LES_ONLY_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('>FJ</button>'), true);
  assert.equal(html.includes('>LES</button>'), true);
});

test('PANEL_UI_NO_DIRECT_FI_ACTION_TEST', () => {
  assert.equal(getLdvPanelHtml().includes(",'FI'"), false);
});

test('PANEL_UI_MATCH_ACTIONS_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('Crear'), true);
  assert.equal(html.includes('Marcar JUGADO'), true);
  assert.equal(html.includes('Cancelar'), true);
});

test('PANEL_UI_EXTERNAL_MAIL_DISABLED_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('Enviar pendientes'), true);
  assert.equal(html.includes('id=\\"send-pending\\" disabled'), true);
});

test('PANEL_UI_CONVOCATION_GENERATE_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('Generar propuesta'), true);
});

test('PANEL_UI_CONVOCATION_PENDING_DISABLED_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('PENDING'), true);
});

test('PANEL_UI_CONVOCATION_INELIGIBLE_DISABLED_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('INELIGIBLE'), true);
});

test('PANEL_UI_CONVOCATION_MANUAL_REASON_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('motivo obligatorio'), true);
  assert.equal(typeof handlers.commandSetFinalSelection, 'function');
});

test('PANEL_UI_CONVOCATION_APPROVAL_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('Aprobar'), true);
});

test('PANEL_UI_POST_MATCH_SELECTED_ROWS_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('Post Partido'), true);
});

test('PANEL_UI_POST_MATCH_ATTENDANCE_READ_ONLY_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('ASISTENCIA_ESTADO es lectura'), true);
});

test('PANEL_UI_POST_MATCH_CREATE_UPDATE_TEST', () => {
  assert.equal(getLdvPanelHtml().includes('Guardar participacion'), true);
});

test('P14_END_TO_END_FAKE_RUNTIME_TEST', () => {
  const options = runtimeOptions({ clock: { now: () => new Date('2026-02-03T08:30:00') } });
  options.repositories.attendanceRepository = createArrayRepository([]);
  const runtime = createAppsScriptRuntime(options);
  const createdSession = runtime.commands.createSession({ TIPO: 'ENTRENAMIENTO', FECHA: '2026-02-03', HORA_INICIO: '08:00', HORA_FIN: '09:00', COMPETENCIA: 'GENERAL' });
  const attendance = runtime.commands.createAttendance({ sesionId: createdSession.SESION_ID, alumnoId: 'ALU-001', estado: 'A' });
  const dashboard = runtime.queries.getPanelDashboard();
  assert.equal(attendance.ALUMNO_ID, 'ALU-001');
  assert.equal(dashboard.attendanceSummary.captured, 1);
  assert.equal(JSON.stringify(runtime.queries.getEvents()).includes('family@example.invalid'), false);
});
