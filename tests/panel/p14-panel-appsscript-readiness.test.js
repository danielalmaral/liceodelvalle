const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
const { createPanelClientController } = require('../../src/PanelClientController');
const { createPanelRenderer } = require('../../src/PanelRenderer');
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

test('PANEL_DASHBOARD_REAL_SHEETS_NUMERIC_GRADE_TEST', () => {
  const options = runtimeOptions();
  options.repositories.studentRepository = createArrayRepository([student({
    GRADO: 1,
    FECHA_ALTA: new Date(2026, 0, 1)
  })]);
  options.repositories.sessionRepository = createArrayRepository([session({
    FECHA: new Date(2026, 1, 1),
    HORA_INICIO: new Date(2000, 0, 1, 8, 0, 0, 0),
    HORA_FIN: new Date(2000, 0, 1, 9, 0, 0, 0)
  })]);

  const dashboard = createAppsScriptRuntime(options).queries.getPanelDashboard();

  assert.equal(dashboard.attendanceBySession[0].expected, 1);
});

test('PANEL_ATTENDANCE_REAL_SHEETS_NUMERIC_GRADE_TEST', () => {
  const options = runtimeOptions();
  options.repositories.studentRepository = createArrayRepository([student({
    GRADO: 1,
    FECHA_ALTA: new Date(2026, 0, 1)
  })]);
  options.repositories.sessionRepository = createArrayRepository([session({
    FECHA: new Date(2026, 1, 1),
    HORA_INICIO: new Date(2000, 0, 1, 8, 0, 0, 0),
    HORA_FIN: new Date(2000, 0, 1, 9, 0, 0, 0)
  })]);

  const view = createAppsScriptRuntime(options).queries.getPanelAttendance('SES-001');

  assert.equal(view.rows[0].studentId, 'ALU-001');
});

test('PANEL_CONVOCATION_VIEW_TEST', () => {
  const view = createAppsScriptRuntime(runtimeOptions()).queries.getPanelConvocation('CON-001');
  assert.equal(view.details[0].ELEGIBILITY_STATUS, 'ELIGIBLE');
  assert.equal(view.details[0].puntajeAsistencia, 1);
});

test('PANEL_REFERENCE_DATA_REAL_SHEETS_TIME_TEST', () => {
  const options = runtimeOptions();
  options.repositories.sessionRepository = createArrayRepository([session({
    HORA_INICIO: new Date(2000, 0, 1, 8, 5, 0, 0),
    HORA_FIN: new Date(2000, 0, 1, 9, 0, 0, 0)
  })]);
  options.repositories.matchRepository = createArrayRepository([match({
    HORA_CITACION: new Date(2000, 0, 1, 9, 5, 0, 0),
    HORA_PARTIDO: new Date(2000, 0, 1, 10, 0, 0, 0)
  })]);

  const data = createAppsScriptRuntime(options).queries.getPanelReferenceData();

  assert.equal(data.openSessions[0].horaInicio, '08:05');
  assert.equal(data.openSessions[0].horaFin, '09:00');
  assert.equal(data.programmedMatches[0].horaCitacion, '09:05');
  assert.equal(data.programmedMatches[0].horaPartido, '10:00');
});

test('PANEL_CONVOCATION_ROUTE_WITH_REAL_SHEETS_TIME_TEST', () => {
  const options = runtimeOptions();
  options.repositories.sessionRepository = createArrayRepository([session({
    HORA_INICIO: new Date(2000, 0, 1, 8, 5, 0, 0),
    HORA_FIN: new Date(2000, 0, 1, 9, 0, 0, 0)
  })]);
  options.repositories.matchRepository = createArrayRepository([match({
    HORA_CITACION: new Date(2000, 0, 1, 9, 5, 0, 0),
    HORA_PARTIDO: new Date(2000, 0, 1, 10, 0, 0, 0)
  })]);

  const runtime = createAppsScriptRuntime(options);
  const state = {
    referenceData: runtime.queries.getPanelReferenceData(),
    convocation: runtime.queries.getPanelConvocation('CON-001')
  };
  const html = createPanelRenderer({ state, controller: {} }).renderConvocations();

  assert.equal(state.referenceData.programmedMatches[0].horaPartido, '10:00');
  assert.ok(html.includes('Aprobado por'));
  assert.ok(html.includes('CON-001'));
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
    queries: { getStudents: () => [], getAttendances: () => [], getSessions: () => [], getMatches: () => [{ partidoId: 'PAR-1', estado: 'JUGADO' }], getCommunications: () => [], getParticipations: () => [], validateMatchParticipationReadiness: () => { readinessCalled += 1; return { alerts: [], errors: [] }; } }
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
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.constructors.createParticipationService = () => ({
    getParticipations: () => [],
    validateMatchParticipationReadiness: () => ({ ready: true, errors: [], alerts: [{ code: 'RED_CARD_REVIEW_REQUIRED', studentId: 'ALU-001', matchId: 'PAR-001' }] })
  });
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().sportAlerts.length, 1);
});

test('PANEL_READINESS_ISSUE_VISIBLE_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
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

test('PANEL_HANDLER_APPROVAL_ACTOR_PASSTHROUGH_TEST', () => {
  let observed = null;
  handlers.setPanelRuntimeFactoryForTest(() => ({
    commands: {
      approveConvocation(convocationId, actor, options) {
        observed = { convocationId, actor, options };
        return { CONVOCATORIA_ID: convocationId, APROBADA_POR: actor };
      }
    },
    runtime: { idGenerator: { operationId: () => 'SERVER_GENERATED' } }
  }));
  try {
    const response = handlers.commandApproveConvocation('CON-001', 'COACH_TEST');
    assert.equal(response.ok, true);
    assert.deepEqual(observed, {
      convocationId: 'CON-001',
      actor: 'COACH_TEST',
      options: { operationId: 'SERVER_GENERATED' }
    });
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
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

function panelRendererHarness(overrides = {}) {
  const calls = [];
  const controller = {};
  [
    'loadDashboard',
    'loadReferenceData',
    'loadAttendance',
    'markAttendance',
    'resolveAbsence',
    'createMatch',
    'updateMatch',
    'markMatchPlayed',
    'cancelMatch',
    'generateConvocation',
    'loadConvocation',
    'setFinalSelection',
    'assignPosition',
    'approveConvocation',
    'prepareConvocationCommunications',
    'sendPendingCommunications',
    'loadPostMatch',
    'saveParticipation'
  ].forEach((name) => {
    controller[name] = (...args) => {
      calls.push({ name, args });
      return { name, args };
    };
  });
  const state = {
    dashboard: {
      currentSession: { sesionId: 'SES-001' },
      pendingAbsences: 1,
      expiredAbsences: 0,
      nextAbsenceDeadline: '2026-02-04T08:00:00Z',
      communications: { pending: 2, error: 1, uncertainDelivery: 1 },
      sportAlerts: [{ code: 'LOW_PARTICIPATION_STREAK' }],
      readinessIssues: [{ code: 'PANEL_POSTMATCH_ATTENDANCE_REQUIRED' }]
    },
    referenceData: {
      openSessions: [
        { sesionId: 'SES-001', competencia: 'A', fecha: '2026-02-03' },
        { sesionId: 'SES-002', competencia: 'B', fecha: '2026-02-04' }
      ],
      programmedMatches: [
        { partidoId: 'PAR-001', rival: 'Rival Ficticio', competencia: 'A', fecha: '2026-02-10', horaPartido: '09:00', sede: 'Cancha' }
      ],
      playedMatches: [
        { partidoId: 'PAR-002', rival: 'Rival Jugado', competencia: 'A', fecha: '2026-02-01' }
      ],
      runtimeCapabilities: { externalMailEnabled: false }
    },
    attendance: {
      rows: [
        { attendanceId: 'AST-001', studentId: 'ALU-001', nombre: 'Alumno Ficticio 1', estadoActual: '', capabilities: { canMarkAttendance: true } },
        { attendanceId: 'AST-002', studentId: 'ALU-002', nombre: 'Alumno Ficticio 2', estadoActual: 'F', capabilities: { canMarkAttendance: false } }
      ]
    },
    convocation: {
      convocationId: 'CON-001',
      details: [
        {
          ALUMNO_ID: 'ALU-001',
          nombre: 'Alumno Ficticio 1',
          ELEGIBILITY_STATUS: 'ELIGIBLE',
          MOTIVO_NO_ELEGIBLE: '',
          nivel: 'A1',
          rotacionAntes: 0,
          prioridadRotacion: 1,
          puntajeAsistencia: 10,
          presenciaReal: true,
          recomendadoSistema: true,
          seleccionadoFinal: true,
          posicionPrincipal: 'DEF',
          posicionSecundaria: 'MED',
          posicionAsignada: 'DEF',
          motivoCambio: ''
        },
        {
          ALUMNO_ID: 'ALU-002',
          nombre: 'Alumno Ficticio 2',
          ELEGIBILITY_STATUS: 'PENDING',
          MOTIVO_NO_ELEGIBLE: 'F pendiente',
          seleccionadoFinal: false,
          posicionPrincipal: 'DEL',
          posicionSecundaria: 'MED'
        },
        {
          ALUMNO_ID: 'ALU-003',
          nombre: 'Alumno Ficticio 3',
          ELEGIBILITY_STATUS: 'INELIGIBLE',
          MOTIVO_NO_ELEGIBLE: 'FI',
          seleccionadoFinal: false,
          posicionPrincipal: 'PO',
          posicionSecundaria: 'DEF'
        }
      ]
    },
    postMatch: {
      readiness: { ready: false },
      issues: [{ code: 'PANEL_POSTMATCH_ATTENDANCE_REQUIRED', studentId: 'ALU-002' }],
      rows: [
        {
          ALUMNO_ID: 'ALU-001',
          nombre: 'Alumno Ficticio 1',
          ASISTENCIA_ESTADO: 'A',
          ASISTIO_DERIVADO: true,
          CONDICION_INICIAL: 'TITULAR',
          MINUTOS_JUGADOS: 60,
          GOLES: 0,
          AMARILLAS: 0,
          ROJAS: 0,
          CALIFICACION: 5,
          OBSERVACIONES: ''
        },
        {
          ALUMNO_ID: 'ALU-002',
          nombre: 'Alumno Ficticio 2',
          ASISTENCIA_ESTADO: '',
          ASISTIO_DERIVADO: false
        }
      ]
    },
    ...overrides
  };
  return { calls, controller, state, renderer: createPanelRenderer({ state, controller }) };
}

function namedContainer(elements) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, '[name]');
      return elements;
    }
  };
}

function namedForm(elements) {
  return { elements };
}

function fakeParticipationButton(row, attrs = {}) {
  return {
    parentNode: { parentNode: row },
    getAttribute(name) {
      return attrs[name] || '';
    }
  };
}

function panelUiAsyncHarness(initialState = {}) {
  const calls = [];
  const content = { className: '', innerHTML: '' };
  const doc = { getElementById(id) { return id === 'content' ? content : { textContent: '' }; } };
  const state = {
    referenceData: {
      openSessions: [{ sesionId: 'SES-001', competencia: 'A', fecha: '2026-02-03' }],
      programmedMatches: [{ partidoId: 'PAR-001', rival: 'Rival', competencia: 'A', fecha: '2026-02-10' }],
      playedMatches: [{ partidoId: 'PAR-002', rival: 'Jugado', competencia: 'A', fecha: '2026-02-01' }],
      convocationProposals: [],
      authoritativeConvocations: [],
      runtimeCapabilities: { externalMailEnabled: true }
    },
    ...initialState
  };
  let currentView = 'dashboard';
  let controller;
  let renderer;

  function callServer(name, args, onSuccess, onFailure) {
    calls.push({ name, args, onSuccess, onFailure });
    return calls[calls.length - 1];
  }

  function routeDashboard(data) {
    if (currentView === 'dashboard') renderer.render('dashboard', data);
    else if (currentView === 'alerts') renderer.render('alerts', data);
  }

  function openConvocations() {
    const id = state.selectedProgrammedMatchId || ((state.referenceData.programmedMatches || [])[0] || {}).partidoId || '';
    if (id) renderer.dispatch({ type: 'resolveConvocationForMatch', matchId: id });
    else renderer.render('convocations');
  }

  function openPostMatch() {
    const id = state.selectedPlayedMatchId || ((state.referenceData.playedMatches || [])[0] || {}).partidoId || '';
    renderer.render('postmatch');
    if (id) controller.loadPostMatch(id);
  }

  controller = createPanelClientController({
    callServer,
    state,
    render: {
      dashboard: routeDashboard,
      referenceData() {
        if (currentView === 'matches') renderer.render('matches');
        else if (currentView === 'convocations') openConvocations();
        else if (currentView === 'postmatch') openPostMatch();
      },
      attendance(data) { renderer.render('attendance', data); },
      convocation(data) { renderer.render('convocations', data); },
      postMatch(data) { renderer.render('postmatch', data); },
      matchWrite() {
        controller.loadReferenceData(() => {
          controller.loadDashboard();
          renderer.render('matches');
        });
      },
      convocationWrite(data) {
        controller.loadReferenceData(() => {
          if (data && data.CONVOCATORIA_ID) controller.loadConvocation(data.CONVOCATORIA_ID);
          else openConvocations();
        });
      },
      communicationWrite() { controller.loadReferenceData(() => renderer.render('convocations')); },
      participationWrite() { controller.loadPostMatch(state.selectedPlayedMatchId); }
    }
  });
  renderer = createPanelRenderer({ state, controller, document: doc });

  function load(view) {
    currentView = view;
    if (view === 'dashboard') {
      controller.loadDashboard();
      controller.loadReferenceData();
    } else if (view === 'attendance') {
      controller.loadReferenceData(() => controller.loadAttendance());
    } else if (view === 'matches') {
      controller.loadReferenceData(() => renderer.render('matches'));
    } else if (view === 'convocations') {
      controller.loadReferenceData(() => openConvocations());
    } else if (view === 'postmatch') {
      controller.loadReferenceData(() => openPostMatch());
    } else if (view === 'alerts') {
      controller.loadDashboard();
      renderer.render('alerts');
    }
  }

  function succeed(call, data) {
    call.onSuccess({ ok: true, data });
  }

  return { calls, content, controller, get currentView() { return currentView; }, load, renderer, state, succeed };
}

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
  const html = createPanelRenderer({
    state: { referenceData: { runtimeCapabilities: { externalMailEnabled: false }, programmedMatches: [] }, convocation: { convocationId: 'CON-001', details: [] } },
    controller: {}
  }).renderConvocations();
  assert.equal(html.includes('Enviar pendientes'), true);
  assert.equal(html.includes('id="send-pending" data-action="communication-send" disabled'), true);
});

test('PANEL_UI_APPROVAL_ACTOR_INPUT_TEST', () => {
  const html = createPanelRenderer({
    state: { referenceData: { runtimeCapabilities: { externalMailEnabled: false }, programmedMatches: [] }, convocation: { convocationId: 'CON-001', details: [] } },
    controller: {}
  }).renderConvocations();
  assert.equal(html.includes('Aprobado por'), true);
  assert.equal(html.includes('id="convocation-approval-actor"'), true);
  assert.equal(html.includes('aria-label="Aprobado por"'), true);
  assert.equal(html.includes('autocomplete="off"'), true);
});

test('PANEL_UI_APPROVAL_EVENT_READS_ACTOR_INPUT_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('document.getElementById("convocation-approval-actor")'), true);
  assert.equal(html.includes('actor:approvalActor&&approvalActor.value'), true);
  assert.equal(html.includes('PANEL_APPROVAL_ACTOR_REQUIRED'), true);
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

test('PANEL_UI_SESSION_SELECTOR_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderAttendance();
  assert.equal(html.includes('id="attendance-session"'), true);
  assert.equal(html.includes('value="SES-001" selected'), true);
  assert.equal(html.includes('value="SES-002"'), true);
});

test('PANEL_UI_SESSION_SELECTOR_CHANGE_TEST', () => {
  const { calls, renderer, state } = panelRendererHarness();
  renderer.dispatch({ type: 'attendanceSessionChange', sessionId: 'SES-002' });
  assert.equal(state.selectedSessionId, 'SES-002');
  assert.deepEqual(calls.at(-1), { name: 'loadAttendance', args: ['SES-002'] });
});

test('PANEL_UI_ATTENDANCE_NO_EMPTY_SESSION_RPC_TEST', () => {
  const { calls, renderer } = panelRendererHarness({ dashboard: {}, referenceData: { openSessions: [] } });
  renderer.dispatch({ type: 'attendanceSessionChange', sessionId: '' });
  renderer.dispatch({ type: 'markAttendance', studentId: 'ALU-001', state: 'A' });
  assert.equal(calls.length, 0);
});

test('PANEL_UI_ATTENDANCE_SELECTED_SESSION_TEST', () => {
  const { calls, renderer } = panelRendererHarness({ selectedSessionId: 'SES-002' });
  renderer.dispatch({ type: 'markAttendance', studentId: 'ALU-001', state: 'R' });
  assert.deepEqual(calls.at(-1), { name: 'markAttendance', args: ['SES-002', 'ALU-001', 'R'] });
});

test('PANEL_UI_ATTENDANCE_USES_ATTENDANCE_ID_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const html = renderer.renderAttendance();
  assert.equal(html.includes('data-attendance-id="AST-002"'), true);
  renderer.dispatch({ type: 'resolveAbsence', attendanceId: 'AST-002', targetState: 'FJ', reason: 'motivo ficticio' });
  assert.deepEqual(calls.at(-1), { name: 'resolveAbsence', args: ['AST-002', 'FJ', 'motivo ficticio'] });
});

test('PANEL_UI_ATTENDANCE_REASON_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderAttendance();
  assert.equal(html.includes('class="absence-reason"'), true);
  assert.equal(html.includes('placeholder="Motivo"'), true);
});

test('PANEL_UI_ATTENDANCE_REFRESH_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('controller.loadReferenceData(function(){controller.loadAttendance();});'), true);
  assert.equal(html.includes('matchWrite:function(){controller.loadReferenceData(function(){controller.loadDashboard();renderer.render("matches");});}'), true);
});

test('PANEL_UI_ATTENDANCE_NO_FI_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderAttendance();
  assert.equal(html.includes('data-state="FI"'), false);
  assert.equal(html.includes('data-target-state="FI"'), false);
});

test('PANEL_UI_MATCH_CREATE_FORM_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderMatches();
  ['COMPETENCIA', 'JORNADA', 'RIVAL', 'FECHA', 'HORA_CITACION', 'HORA_PARTIDO', 'SEDE', 'LOCAL_VISITANTE', 'DURACION_MINUTOS', 'UNIFORME', 'INDICACIONES', 'OBSERVACIONES'].forEach((name) => {
    assert.equal(html.includes(`name="${name}"`), true, name);
  });
});

test('PANEL_UI_MATCH_CREATE_REAL_PAYLOAD_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  renderer.dispatch({ type: 'createMatch', payload: { RIVAL: 'Rival Ficticio', FECHA: '2026-02-10', ignored: 'client' } });
  assert.deepEqual(calls.at(-1), { name: 'createMatch', args: [{ RIVAL: 'Rival Ficticio', FECHA: '2026-02-10' }] });
});

test('PANEL_UI_MATCH_UPDATE_REAL_ID_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const html = renderer.renderMatches();
  assert.equal(html.includes('data-match-id="PAR-001"'), true);
  renderer.dispatch({ type: 'updateMatch', matchId: 'PAR-001', payload: { SEDE: 'Cancha 2', ignored: 'client' } });
  assert.deepEqual(calls.at(-1), { name: 'updateMatch', args: ['PAR-001', { SEDE: 'Cancha 2' }] });
});

test('PANEL_UI_MATCH_PLAYED_AND_CANCEL_REAL_ID_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  renderer.dispatch({ type: 'markMatchPlayed', matchId: 'PAR-001', payload: { GOLES_FAVOR: '2', GOLES_CONTRA: '1', ESTADO: 'client' } });
  renderer.dispatch({ type: 'cancelMatch', matchId: 'PAR-001' });
  assert.deepEqual(calls.at(-2), { name: 'markMatchPlayed', args: ['PAR-001', { GOLES_FAVOR: '2', GOLES_CONTRA: '1' }] });
  assert.deepEqual(calls.at(-1), { name: 'cancelMatch', args: ['PAR-001'] });
});

test('PANEL_UI_CONVOCATION_MATCH_SELECTOR_AND_GENERATE_REAL_ID_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const html = renderer.renderConvocations();
  assert.equal(html.includes('id="convocation-match"'), true);
  assert.equal(html.includes('data-match-id="PAR-001"'), true);
  renderer.dispatch({ type: 'generateConvocation', matchId: 'PAR-001' });
  assert.deepEqual(calls.at(-1), { name: 'generateConvocation', args: ['PAR-001'] });
});

test('PANEL_UI_CONVOCATION_DISABLED_STATUSES_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderConvocations();
  assert.equal(html.includes('PENDING'), true);
  assert.equal(html.includes('INELIGIBLE'), true);
  assert.equal((html.match(/disabled/g) || []).length >= 4, true);
});

test('PANEL_UI_CONVOCATION_SELECTION_POSITION_REASON_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const html = renderer.renderConvocations();
  assert.equal(html.includes('class="convocation-reason"'), true);
  assert.equal(html.includes('<option value="DEF" selected>DEF</option><option value="MED">MED</option>'), true);
  renderer.dispatch({ type: 'setFinalSelection', convocationId: 'CON-001', studentId: 'ALU-001', selected: false, reason: 'rotacion ficticia' });
  renderer.dispatch({ type: 'assignPosition', convocationId: 'CON-001', studentId: 'ALU-001', position: 'MED', reason: 'rotacion ficticia' });
  assert.deepEqual(calls.at(-2), { name: 'setFinalSelection', args: ['CON-001', 'ALU-001', false, 'rotacion ficticia'] });
  assert.deepEqual(calls.at(-1), { name: 'assignPosition', args: ['CON-001', 'ALU-001', 'MED', 'rotacion ficticia'] });
});

test('PANEL_UI_CONVOCATION_APPROVE_PREPARE_SEND_TEST', () => {
  const { calls, renderer } = panelRendererHarness({ referenceData: { runtimeCapabilities: { externalMailEnabled: true }, programmedMatches: [] } });
  const html = renderer.renderConvocations();
  assert.equal(html.includes('id="send-pending" data-action="communication-send" >Enviar pendientes</button>'), true);
  renderer.dispatch({ type: 'approveConvocation', convocationId: 'CON-001', actor: 'COACH_TEST' });
  renderer.dispatch({ type: 'prepareCommunications', convocationId: 'CON-001' });
  renderer.dispatch({ type: 'sendPendingCommunications' });
  assert.deepEqual(calls.slice(-3).map((call) => call.name), ['approveConvocation', 'prepareConvocationCommunications', 'sendPendingCommunications']);
});

test('PANEL_UI_APPROVAL_ACTOR_REQUIRED_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  assert.throws(() => renderer.dispatch({ type: 'approveConvocation', convocationId: 'CON-001', actor: '' }), /PANEL_APPROVAL_ACTOR_REQUIRED/);
  assert.equal(calls.some((call) => call.name === 'approveConvocation'), false);
});

test('PANEL_UI_APPROVAL_ACTOR_TRIM_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  renderer.dispatch({ type: 'approveConvocation', convocationId: 'CON-001', actor: '  COACH_TEST  ' });
  assert.deepEqual(calls.at(-1), { name: 'approveConvocation', args: ['CON-001', 'COACH_TEST'] });
});

test('PANEL_UI_APPROVAL_NO_EMPTY_ACTOR_RPC_TEST', () => {
  [undefined, null, '', '   '].forEach((actor) => {
    const ui = panelUiAsyncHarness();
    assert.throws(() => ui.renderer.dispatch({ type: 'approveConvocation', convocationId: 'CON-001', actor }), /PANEL_APPROVAL_ACTOR_REQUIRED/);
    assert.equal(ui.calls.some((call) => call.name === 'commandApproveConvocation'), false);
  });
});

test('PANEL_UI_POSTMATCH_SELECTOR_AND_SELECTED_ROWS_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const html = renderer.renderPostMatch();
  assert.equal(html.includes('id="postmatch-match"'), true);
  assert.equal(html.includes('data-student-id="ALU-001"'), true);
  renderer.dispatch({ type: 'selectPlayedMatch', matchId: 'PAR-002' });
  assert.deepEqual(calls.at(-1), { name: 'loadPostMatch', args: ['PAR-002'] });
});

test('PANEL_UI_POSTMATCH_READINESS_ISSUES_AND_READONLY_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderPostMatch();
  assert.equal(html.includes('PANEL_POSTMATCH_ATTENDANCE_REQUIRED'), true);
  assert.equal(html.includes('<td class="readonly">A</td>'), true);
  assert.equal(html.includes('name="ASISTENCIA_ESTADO"'), false);
});

test('PANEL_UI_POSTMATCH_SAVE_PAYLOAD_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  renderer.dispatch({
    type: 'saveParticipation',
    matchId: 'PAR-002',
    studentId: 'ALU-001',
    payload: { CONDICION_INICIAL: 'TITULAR', MINUTOS_JUGADOS: '60', ASISTENCIA_ESTADO: 'client', ASISTIO: 'client' }
  });
  assert.deepEqual(calls.at(-1), { name: 'saveParticipation', args: ['PAR-002', 'ALU-001', { CONDICION_INICIAL: 'TITULAR', MINUTOS_JUGADOS: '60' }] });
});

test('PANEL_UI_POSTMATCH_DOM_PAYLOAD_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const row = namedContainer([
    { name: 'CONDICION_INICIAL', value: 'SUPLENTE' },
    { name: 'MINUTOS_JUGADOS', value: '15' },
    { name: 'GOLES', value: '1' },
    { name: 'AMARILLAS', value: '0' },
    { name: 'ROJAS', value: '0' },
    { name: 'CALIFICACION', value: '4.5' },
    { name: 'OBSERVACIONES', value: 'ok ficticio' }
  ]);
  renderer.dispatch({ type: 'saveParticipationFromElement', button: fakeParticipationButton(row, { 'data-match-id': 'PAR-002', 'data-student-id': 'ALU-001' }) });
  assert.deepEqual(calls.at(-1), {
    name: 'saveParticipation',
    args: ['PAR-002', 'ALU-001', { CONDICION_INICIAL: 'SUPLENTE', MINUTOS_JUGADOS: '15', GOLES: '1', AMARILLAS: '0', ROJAS: '0', CALIFICACION: '4.5', OBSERVACIONES: 'ok ficticio' }]
  });
});

test('PANEL_UI_POSTMATCH_DOM_ZERO_VALUES_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const row = namedContainer([
    { name: 'CONDICION_INICIAL', value: 'TITULAR' },
    { name: 'MINUTOS_JUGADOS', value: '0' },
    { name: 'GOLES', value: '0' },
    { name: 'AMARILLAS', value: '0' },
    { name: 'ROJAS', value: '0' },
    { name: 'CALIFICACION', value: '0' },
    { name: 'OBSERVACIONES', value: '' }
  ]);
  renderer.dispatch({ type: 'saveParticipationFromElement', button: fakeParticipationButton(row, { 'data-match-id': 'PAR-002', 'data-student-id': 'ALU-001' }) });
  assert.deepEqual(calls.at(-1).args[2], { CONDICION_INICIAL: 'TITULAR', MINUTOS_JUGADOS: '0', GOLES: '0', AMARILLAS: '0', ROJAS: '0', CALIFICACION: '0', OBSERVACIONES: '' });
});

test('PANEL_UI_POSTMATCH_CLIENT_AUTHORITY_FIELDS_EXCLUDED_TEST', () => {
  const { calls, renderer } = panelRendererHarness();
  const row = namedContainer([
    { name: 'CONDICION_INICIAL', value: 'TITULAR' },
    { name: 'MINUTOS_JUGADOS', value: '60' },
    { name: 'ASISTENCIA_ESTADO', value: 'F' },
    { name: 'ASISTIO', value: 'FALSE' },
    { name: 'CONVOCATORIA_ID', value: 'CON-CLIENT' },
    { name: 'PARTICIPACION_ID', value: 'PRT-CLIENT' },
    { name: 'ALUMNO_ID', value: 'ALU-CLIENT' }
  ]);
  renderer.dispatch({ type: 'saveParticipationFromElement', button: fakeParticipationButton(row, { 'data-match-id': 'PAR-002', 'data-student-id': 'ALU-001' }) });
  assert.deepEqual(calls.at(-1).args[2], { CONDICION_INICIAL: 'TITULAR', MINUTOS_JUGADOS: '60' });
});

test('PANEL_UI_ALERTS_FROM_DASHBOARD_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderAlerts();
  assert.equal(html.includes('LOW_PARTICIPATION_STREAK'), true);
  assert.equal(html.includes('PANEL_POSTMATCH_ATTENDANCE_REQUIRED'), true);
  assert.equal(html.includes('Comunicaciones error'), true);
});

test('PANEL_UI_ALERTS_ASYNC_ROUTING_TEST', () => {
  const ui = panelUiAsyncHarness();
  ui.load('alerts');
  const dashboardCall = ui.calls.find((call) => call.name === 'getPanelDashboard');
  ui.succeed(dashboardCall, { pendingAbsences: 3, communications: { error: 2 }, sportAlerts: [{ code: 'LOW_PARTICIPATION_STREAK' }] });
  assert.equal(ui.content.innerHTML.includes('alerts-view'), true);
  assert.equal(ui.content.innerHTML.includes('LOW_PARTICIPATION_STREAK'), true);
  assert.equal(ui.content.innerHTML.includes('Sesion actual/proxima'), false);
});

test('PANEL_UI_MATCH_REFRESH_NO_DASHBOARD_OVERRIDE_TEST', () => {
  const ui = panelUiAsyncHarness();
  ui.load('matches');
  ui.succeed(ui.calls.at(-1), ui.state.referenceData);
  ui.renderer.dispatch({ type: 'createMatch', payload: namedForm([{ name: 'RIVAL', value: 'Rival Nuevo' }, { name: 'FECHA', value: '2026-02-11' }]) });
  ui.succeed(ui.calls.find((call) => call.name === 'commandCreateMatch'), { PARTIDO_ID: 'PAR-003' });
  const referenceRefresh = ui.calls.filter((call) => call.name === 'getPanelReferenceData').at(-1);
  ui.succeed(referenceRefresh, ui.state.referenceData);
  const dashboardRefresh = ui.calls.filter((call) => call.name === 'getPanelDashboard').at(-1);
  assert.equal(ui.content.innerHTML.includes('programmed-matches'), true);
  ui.succeed(dashboardRefresh, { pendingAbsences: 9 });
  assert.equal(ui.content.innerHTML.includes('programmed-matches'), true);
  assert.equal(ui.content.innerHTML.includes('Sesion actual/proxima'), false);
});

test('PANEL_UI_CURRENT_VIEW_PRESERVED_TEST', () => {
  const ui = panelUiAsyncHarness();
  ui.load('matches');
  ui.succeed(ui.calls.at(-1), ui.state.referenceData);
  ui.load('alerts');
  const dashboardCall = ui.calls.filter((call) => call.name === 'getPanelDashboard').at(-1);
  ui.succeed(dashboardCall, { readinessIssues: [{ code: 'PANEL_POSTMATCH_ATTENDANCE_REQUIRED' }], communications: {} });
  assert.equal(ui.currentView, 'alerts');
  assert.equal(ui.content.innerHTML.includes('alerts-view'), true);
});

test('PANEL_CLIENT_POSTMATCH_SELECTION_STATE_TEST', () => {
  const calls = [];
  const state = {};
  const controller = createPanelClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      onSuccess({ ok: true, data: { rows: [] } });
    },
    state
  });
  controller.loadPostMatch('PAR-002');
  assert.equal(state.selectedPlayedMatchId, 'PAR-002');
  assert.deepEqual(calls[0], { name: 'getPanelParticipation', args: ['PAR-002'] });
});

test('PANEL_UI_POSTMATCH_DEFAULT_SELECTION_TEST', () => {
  const ui = panelUiAsyncHarness();
  ui.load('postmatch');
  ui.succeed(ui.calls.at(-1), ui.state.referenceData);
  assert.equal(ui.state.selectedPlayedMatchId, 'PAR-002');
  assert.deepEqual(ui.calls.at(-1), { ...ui.calls.at(-1), name: 'getPanelParticipation', args: ['PAR-002'] });
});

test('PANEL_UI_POSTMATCH_SAVE_RELOAD_SAME_MATCH_TEST', () => {
  const ui = panelUiAsyncHarness({ selectedPlayedMatchId: 'PAR-002' });
  ui.renderer.dispatch({ type: 'saveParticipationFromElement', button: fakeParticipationButton(namedContainer([{ name: 'CONDICION_INICIAL', value: 'TITULAR' }]), { 'data-match-id': 'PAR-002', 'data-student-id': 'ALU-001' }) });
  const saveCall = ui.calls.find((call) => call.name === 'commandSaveParticipation');
  ui.succeed(saveCall, { ok: true });
  assert.equal(ui.calls.at(-1).name, 'getPanelParticipation');
  assert.deepEqual(ui.calls.at(-1).args, ['PAR-002']);
});

test('PANEL_UI_POSTMATCH_NO_EMPTY_MATCH_RPC_TEST', () => {
  const ui = panelUiAsyncHarness({ referenceData: { playedMatches: [] } });
  ui.controller.loadPostMatch('');
  ui.renderer.dispatch({ type: 'selectPlayedMatch', matchId: '' });
  ui.renderer.dispatch({ type: 'saveParticipation', studentId: 'ALU-001', payload: namedContainer([{ name: 'CONDICION_INICIAL', value: 'TITULAR' }]) });
  assert.equal(ui.calls.some((call) => call.name === 'getPanelParticipation' && call.args[0] === ''), false);
  assert.equal(ui.calls.some((call) => call.name === 'commandSaveParticipation'), false);
});

test('PANEL_UI_EXISTING_PROPOSAL_RESUME_TEST', () => {
  const { calls, renderer } = panelRendererHarness({
    referenceData: {
      programmedMatches: [{ partidoId: 'PAR-001', rival: 'Rival', fecha: '2026-02-10' }],
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-PROP', PARTIDO_ID: 'PAR-001' }],
      authoritativeConvocations: [],
      runtimeCapabilities: { externalMailEnabled: false }
    }
  });
  renderer.dispatch({ type: 'resolveConvocationForMatch', matchId: 'PAR-001' });
  assert.deepEqual(calls.at(-1), { name: 'loadConvocation', args: ['CON-PROP'] });
});

test('PANEL_UI_EXISTING_AUTHORITATIVE_RESUME_TEST', () => {
  const { calls, renderer } = panelRendererHarness({
    referenceData: {
      programmedMatches: [{ partidoId: 'PAR-001', rival: 'Rival', fecha: '2026-02-10' }],
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-PROP', PARTIDO_ID: 'PAR-001' }],
      authoritativeConvocations: [{ CONVOCATORIA_ID: 'CON-AUTH', PARTIDO_ID: 'PAR-001' }],
      runtimeCapabilities: { externalMailEnabled: false }
    }
  });
  renderer.dispatch({ type: 'resolveConvocationForMatch', matchId: 'PAR-001' });
  assert.deepEqual(calls.at(-1), { name: 'loadConvocation', args: ['CON-AUTH'] });
});

test('PANEL_UI_CONVOCATION_SWITCH_MATCH_LOAD_TEST', () => {
  const { calls, renderer, state } = panelRendererHarness({
    referenceData: {
      programmedMatches: [{ partidoId: 'PAR-001', rival: 'Uno', fecha: '2026-02-10' }, { partidoId: 'PAR-002', rival: 'Dos', fecha: '2026-02-11' }],
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002' }],
      authoritativeConvocations: [],
      runtimeCapabilities: { externalMailEnabled: false }
    }
  });
  renderer.dispatch({ type: 'selectProgrammedMatch', matchId: 'PAR-002' });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.deepEqual(calls.at(-1), { name: 'loadConvocation', args: ['CON-002'] });
});

test('PANEL_UI_CONVOCATION_NO_DUPLICATE_GENERATE_TEST', () => {
  const { calls, renderer } = panelRendererHarness({
    referenceData: {
      programmedMatches: [{ partidoId: 'PAR-001', rival: 'Rival', fecha: '2026-02-10' }],
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-PROP', PARTIDO_ID: 'PAR-001' }],
      authoritativeConvocations: [],
      runtimeCapabilities: { externalMailEnabled: false }
    }
  });
  const html = renderer.renderConvocations();
  assert.equal(html.includes('data-action="convocation-generate" data-match-id="PAR-001" disabled'), true);
  renderer.dispatch({ type: 'generateConvocation', matchId: 'PAR-001' });
  assert.equal(calls.some((call) => call.name === 'generateConvocation'), false);
});

test('PANEL_UI_CONVOCATION_REOPEN_WORKFLOW_TEST', () => {
  const ui = panelUiAsyncHarness({
    referenceData: {
      programmedMatches: [{ partidoId: 'PAR-001', rival: 'Rival', competencia: 'A', fecha: '2026-02-10' }],
      playedMatches: [],
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001' }],
      authoritativeConvocations: [],
      runtimeCapabilities: { externalMailEnabled: false }
    }
  });
  ui.load('convocations');
  ui.succeed(ui.calls.at(-1), ui.state.referenceData);
  assert.deepEqual(ui.calls.at(-1), { ...ui.calls.at(-1), name: 'getPanelConvocation', args: ['CON-001'] });
});

test('PANEL_UI_DASHBOARD_NEXT_MATCH_A_B_TEST', () => {
  const { renderer } = panelRendererHarness({
    dashboard: {
      nextMatchA: { partidoId: 'PAR-A' },
      nextMatchB: { partidoId: 'PAR-B' },
      expiredAbsences: 2,
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-001' }],
      convocationStatusByMatch: {}
    }
  });
  const html = renderer.renderDashboard();
  assert.equal(html.includes('Proximo A'), true);
  assert.equal(html.includes('PAR-A'), true);
  assert.equal(html.includes('Proximo B'), true);
  assert.equal(html.includes('PAR-B'), true);
  assert.equal(html.includes('Faltas vencidas'), true);
  assert.equal(html.includes('Convocatorias pendientes'), true);
});

test('PANEL_UI_CONVOCATION_SNAPSHOT_FIELDS_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderConvocations();
  ['posicionPrincipal', 'posicionSecundaria', 'posicionAsignada', 'ordenPrioridad', 'cambioManual', 'rotationException'].forEach((label) => {
    assert.equal(html.includes(label), true, label);
  });
});

test('PANEL_UI_POSTMATCH_CONDITION_SELECT_TEST', () => {
  const { renderer } = panelRendererHarness();
  const html = renderer.renderPostMatch();
  assert.equal(html.includes('<select name="CONDICION_INICIAL">'), true);
  assert.equal(html.includes('<option value="TITULAR" selected>TITULAR</option>'), true);
  assert.equal(html.includes('<option value="SUPLENTE">SUPLENTE</option>'), true);
});

test('PANEL_CLIENT_UI_INTEGRATION_FLOW_TEST', () => {
  const ui = panelUiAsyncHarness({
    attendance: {
      rows: [
        { attendanceId: '', studentId: 'ALU-001', nombre: 'Alumno 1', estadoActual: '', capabilities: { canMarkAttendance: true } },
        { attendanceId: 'AST-002', studentId: 'ALU-002', nombre: 'Alumno 2', estadoActual: 'F', capabilities: { canResolveAbsence: true } }
      ]
    },
    convocation: {
      convocationId: 'CON-001',
      details: [{ ALUMNO_ID: 'ALU-001', nombre: 'Alumno 1', ELEGIBILITY_STATUS: 'ELIGIBLE', seleccionadoFinal: true, posicionPrincipal: 'DEF', posicionSecundaria: 'MED', posicionAsignada: 'DEF' }]
    },
    postMatch: {
      rows: [{ ALUMNO_ID: 'ALU-001', nombre: 'Alumno 1', ASISTENCIA_ESTADO: 'A', ASISTIO_DERIVADO: true, CONDICION_INICIAL: 'TITULAR', MINUTOS_JUGADOS: 60 }],
      readiness: { ready: true },
      issues: []
    }
  });
  ui.load('attendance');
  ui.succeed(ui.calls.at(-1), ui.state.referenceData);
  ui.succeed(ui.calls.at(-1), ui.state.attendance);
  ui.renderer.dispatch({ type: 'attendanceSessionChange', sessionId: 'SES-001' });
  ui.renderer.dispatch({ type: 'markAttendance', studentId: 'ALU-001', state: 'A' });
  ui.renderer.dispatch({ type: 'resolveAbsence', attendanceId: 'AST-002', targetState: 'FJ', reason: 'motivo ficticio' });
  ui.load('matches');
  ui.succeed(ui.calls.at(-1), ui.state.referenceData);
  ui.renderer.dispatch({ type: 'createMatch', payload: namedForm([{ name: 'RIVAL', value: 'Nuevo' }, { name: 'FECHA', value: '2026-02-12' }]) });
  ui.renderer.dispatch({ type: 'updateMatch', matchId: 'PAR-001', payload: namedForm([{ name: 'SEDE', value: 'Cancha 2' }]) });
  ui.renderer.dispatch({ type: 'markMatchPlayed', matchId: 'PAR-001', payload: namedForm([{ name: 'GOLES_FAVOR', value: '1' }, { name: 'GOLES_CONTRA', value: '0' }]) });
  ui.renderer.dispatch({ type: 'cancelMatch', matchId: 'PAR-001' });
  ui.load('convocations');
  ui.succeed(ui.calls.filter((call) => call.name === 'getPanelReferenceData').at(-1), ui.state.referenceData);
  ui.renderer.dispatch({ type: 'generateConvocation', matchId: 'PAR-001' });
  ui.succeed(ui.calls.find((call) => call.name === 'commandGenerateConvocation'), { CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001' });
  ui.renderer.dispatch({ type: 'setFinalSelection', convocationId: 'CON-001', studentId: 'ALU-001', selected: true, reason: 'motivo' });
  ui.renderer.dispatch({ type: 'assignPosition', convocationId: 'CON-001', studentId: 'ALU-001', position: 'MED', reason: 'motivo' });
  ui.renderer.dispatch({ type: 'approveConvocation', convocationId: 'CON-001', actor: 'COACH_TEST' });
  ui.renderer.dispatch({ type: 'prepareCommunications', convocationId: 'CON-001' });
  ui.load('postmatch');
  ui.succeed(ui.calls.filter((call) => call.name === 'getPanelReferenceData').at(-1), ui.state.referenceData);
  assert.equal(ui.state.selectedPlayedMatchId, 'PAR-002');
  ui.renderer.dispatch({ type: 'saveParticipationFromElement', button: fakeParticipationButton(namedContainer([{ name: 'CONDICION_INICIAL', value: 'TITULAR' }, { name: 'MINUTOS_JUGADOS', value: '60' }]), { 'data-match-id': 'PAR-002', 'data-student-id': 'ALU-001' }) });
  ui.succeed(ui.calls.find((call) => call.name === 'commandSaveParticipation'), {});
  assert.deepEqual(ui.calls.at(-1).args, ['PAR-002']);
  ui.load('alerts');
  ui.succeed(ui.calls.filter((call) => call.name === 'getPanelDashboard').at(-1), { sportAlerts: [{ code: 'LOW_PARTICIPATION_STREAK' }], communications: {} });
  assert.equal(ui.content.innerHTML.includes('alerts-view'), true);
  ui.succeed(ui.calls.filter((call) => call.name === 'getPanelDashboard').at(-1), { pendingAbsences: 1, communications: {} });
  assert.equal(ui.content.innerHTML.includes('alerts-view'), true);

  const names = ui.calls.map((call) => call.name);
  ['getPanelReferenceData', 'getPanelAttendance', 'commandCreateAttendance', 'commandResolveAbsence', 'commandCreateMatch', 'commandUpdateMatch', 'commandMarkMatchPlayed', 'commandCancelMatch', 'commandGenerateConvocation', 'commandSetFinalSelection', 'commandAssignPosition', 'commandApproveConvocation', 'commandPrepareConvocationCommunications', 'getPanelParticipation', 'commandSaveParticipation', 'getPanelDashboard'].forEach((name) => {
    assert.equal(names.includes(name), true, name);
  });
  assert.deepEqual(ui.calls.find((call) => call.name === 'commandApproveConvocation').args, ['CON-001', 'COACH_TEST']);
  assert.equal(ui.calls.some((call) => call.args && call.args.includes('')), false);
});

test('P14_UI_REQUIRES_BOUND_CONTAINER_TEST', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'PanelUi.js'), 'utf8');
  assert.equal(source.includes('SpreadsheetApp.getUi().showSidebar'), true);
  assert.equal(source.includes('function doGet'), false);
});

function docsText(files) {
  return files.map((file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8')).join('\n');
}

test('P14_CONTAINER_BOUND_DEPLOYMENT_CONTRACT_TEST', () => {
  const text = docsText([
    'README.md',
    'docs/ARCHITECTURE.md',
    'docs/APPS_SCRIPT_BOOTSTRAP_CONTRACT.md',
    'docs/REAL_GOOGLE_SMOKE_RUNBOOK.md',
    'docs/P14_OPERATIONAL_WORKFLOW.md',
    'docs/SAFE_BATCH_P14_REPORT.md',
    'docs/PANEL_CONTRACT.md'
  ]);
  assert.match(text, /Apps Script container-bound/);
  assert.match(text, /Spreadsheet container/);
  assert.doesNotMatch(text, /standalone/i);
  assert.doesNotMatch(text, /web app/i);
});

function appendRecords(sheet, headers, records) {
  records.forEach((record) => {
    sheet.rows.push(headers.map((header) => record[header] === undefined ? '' : record[header]));
  });
}

function productionLikeRuntimeFromSpreadsheet(spreadsheet, overrides = {}) {
  return createLdvAppsScriptRuntime({
    constructors: constructors(),
    createConfigRepository,
    createSheetRepository,
    createTriggerHandlers,
    environment: { getSpreadsheetId: () => 'fake-sheet', getExternalMailEnabled: () => false },
    idGenerator: {
      attendanceId: () => 'AST-REAL',
      matchId: () => 'PAR-REAL',
      operationId: () => 'OP-REAL',
      participationId: () => 'PRT-REAL',
      sessionId: () => 'SES-REAL'
    },
    lock: { runExclusive(callback) { return callback(); } },
    mailAdapter: { send() { throw new Error('REAL_MAIL_FORBIDDEN'); } },
    repositoryFactory: createAppsScriptRepositoryFactory({ spreadsheet, createSheetRepository, createConfigRepository }),
    runtimeFactory: createAppsScriptRuntime,
    spreadsheet,
    utils,
    ...overrides
  });
}

function sequenceIdGenerator() {
  const counters = {};
  function next(prefix) {
    counters[prefix] = (counters[prefix] || 0) + 1;
    return `${prefix}-${String(counters[prefix]).padStart(3, '0')}`;
  }
  return {
    attendanceId: () => next('AST'),
    communicationId: () => next('COM'),
    convocationId: () => next('CON'),
    detailId: (studentId) => `DET-${studentId}`,
    matchId: () => next('PAR'),
    operationId: () => next('OP'),
    participationId: () => next('PRT'),
    sessionId: () => next('SES')
  };
}

function e2eStudents() {
  const positions = [
    ['PO', 'DEF'], ['PO', 'DEF'],
    ['DEF', 'MED'], ['DEF', 'MED'], ['DEF', 'MED'], ['DEF', 'MED'], ['DEF', 'MED'], ['DEF', 'MED'],
    ['MED', 'DEF'], ['MED', 'DEF'], ['MED', 'DEF'], ['MED', 'DEF'], ['MED', 'DEF'], ['MED', 'DEF'],
    ['DEL', 'MED'], ['DEL', 'MED'], ['DEL', 'MED'], ['DEL', 'MED'], ['DEL', 'MED'], ['DEL', 'MED']
  ];
  return positions.map((pair, index) => student({
    ALUMNO_ID: `ALU-${String(index + 1).padStart(3, '0')}`,
    NOMBRE: `Alumno${String(index + 1).padStart(2, '0')}`,
    APELLIDOS: `Ficticio${String(index + 1).padStart(2, '0')}`,
    POSICION_PRINCIPAL: pair[0],
    POSICION_SECUNDARIA: pair[1],
    NIVEL: 'A1'
  }));
}

function e2eTutors(students) {
  return students.map((row, index) => tutor({
    TUTOR_ID: `TUT-${String(index + 1).padStart(3, '0')}`,
    ALUMNO_ID: row.ALUMNO_ID,
    EMAIL: `tutor-${String(index + 1).padStart(2, '0')}@example.invalid`
  }));
}

function selectedDetails(spreadsheet, convocationId) {
  return createSheetRepository({ sheet: spreadsheet.sheets.CONVOCATORIA_DETALLE, headers: CONVOCATION_DETAIL_HEADERS })
    .getAll()
    .filter((row) => row.CONVOCATORIA_ID === convocationId && row.SELECCIONADO_FINAL === true);
}

function countPositions(details) {
  return details.reduce((counts, row) => {
    counts[row.POSICION_ASIGNADA] = (counts[row.POSICION_ASIGNADA] || 0) + 1;
    return counts;
  }, {});
}

function assertPanelSafe(value, seen = new Set()) {
  if (value instanceof Date) assert.fail('Date instance crossed panel boundary');
  if (typeof value === 'function') assert.fail('Function crossed panel boundary');
  if (value && typeof value === 'object') {
    if (seen.has(value)) assert.fail('Circular value crossed panel boundary');
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => assert.notEqual(item, undefined));
    }
    Object.values(value).forEach((item) => assertPanelSafe(item, seen));
    seen.delete(value);
  }
}

test('P14_END_TO_END_FAKE_RUNTIME_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  const idGenerator = sequenceIdGenerator();
  const students = e2eStudents();
  const sentMessages = [];
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  appendRecords(spreadsheet.sheets.CONFIG, CONFIG_HEADERS, completeConfigRows());
  appendRecords(spreadsheet.sheets.ALUMNOS, STUDENT_HEADERS, students);
  appendRecords(spreadsheet.sheets.TUTORES, TUTOR_HEADERS, e2eTutors(students));

  const runtime = productionLikeRuntimeFromSpreadsheet(spreadsheet, {
    clock: { now: () => new Date('2026-02-03T08:00:00Z') },
    environment: { getSpreadsheetId: () => 'fake-sheet', getExternalMailEnabled: () => true },
    idGenerator,
    mailAdapter: { send(message) { sentMessages.push(message); } }
  });

  assert.equal(runtime.queries.verifyConfigReady().ready, true, 'P14_E2E_CONFIG_READY_ASSERT');

  const trainingSession = runtime.commands.createSession({
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-03',
    HORA_INICIO: '08:00',
    HORA_FIN: '09:00',
    COMPETENCIA: 'GENERAL'
  }, { operationId: 'OP-E2E-TRAINING', actor: 'coach' });
  students.forEach((row, index) => {
    runtime.commands.createAttendance({
      sesionId: trainingSession.SESION_ID,
      alumnoId: row.ALUMNO_ID,
      estado: index === 0 ? 'F' : (index % 3 === 0 ? 'R' : 'A')
    });
  });
  assert.equal(runtime.queries.getPanelAttendance(trainingSession.SESION_ID).rows.filter((row) => row.estadoActual).length, 20, 'P14_E2E_ATTENDANCE_ASSERT');

  const absence = runtime.queries.getAttendances().filter((row) => row.estado === 'F')[0];
  const absenceReplay = runtime.commands.resolveAbsence(absence.asistenciaId, 'FJ', { operationId: 'OP-E2E-ABSENCE', actor: 'coach', reason: 'motivo ficticio' });
  assert.equal(absenceReplay.attendance.ESTADO, 'FJ', 'P14_E2E_ABSENCE_ASSERT');

  const matchRow = runtime.commands.createMatch({
    COMPETENCIA: 'A',
    JORNADA: 'J1',
    RIVAL: 'Rival Ficticio',
    FECHA: '2026-02-10',
    HORA_CITACION: '08:00',
    HORA_PARTIDO: '09:00',
    SEDE: 'Cancha Ficticia',
    LOCAL_VISITANTE: 'LOCAL',
    DURACION_MINUTOS: 60,
    UNIFORME: 'Blanco',
    INDICACIONES: 'Llegar puntual',
    OBSERVACIONES: ''
  }, { operationId: 'OP-E2E-MATCH', actor: 'coach' });
  const matchSession = runtime.commands.createSession({
    TIPO: 'PARTIDO',
    FECHA: '2026-02-10',
    HORA_INICIO: '09:00',
    HORA_FIN: '10:00',
    COMPETENCIA: 'A',
    PARTIDO_ID: matchRow.PARTIDO_ID
  }, { operationId: 'OP-E2E-MATCH-SESSION', actor: 'coach' });
  students.forEach((row) => {
    runtime.commands.createAttendance({ sesionId: matchSession.SESION_ID, alumnoId: row.ALUMNO_ID, estado: 'A' });
  });

  const generated = runtime.commands.generateConvocation(matchRow.PARTIDO_ID, 'coach');
  const convocationId = generated.convocation.CONVOCATORIA_ID;
  assert.equal(generated.convocation.TOTAL_OBJETIVO, 18);
  assert.equal(generated.details.filter((row) => row.SELECCIONADO_FINAL).length, 18, 'P14_E2E_CONVOCATION_18_ASSERT');
  let counts = countPositions(generated.details.filter((row) => row.SELECCIONADO_FINAL));
  assert.equal(counts.PO >= 1 && counts.DEF >= 4 && counts.MED >= 4 && counts.DEL >= 3, true, 'P14_E2E_POSITION_MINIMA_ASSERT');

  const selectedDel = generated.details.find((row) => row.SELECCIONADO_FINAL && row.POSICION_ASIGNADA === 'DEL');
  const unselectedDel = generated.details.find((row) => !row.SELECCIONADO_FINAL && row.POSICION_PRINCIPAL_SNAPSHOT === 'DEL');
  runtime.commands.setFinalSelection(convocationId, unselectedDel.ALUMNO_ID, true, 'swap ficticio', { operationId: 'OP-E2E-SELECT-IN', actor: 'coach' });
  const deselected = runtime.commands.setFinalSelection(convocationId, selectedDel.ALUMNO_ID, false, 'swap ficticio', { operationId: 'OP-E2E-SELECT-OUT', actor: 'coach' });
  assert.equal(deselected.MOTIVO_CAMBIO, 'swap ficticio', 'P14_E2E_MANUAL_CHANGE_ASSERT');
  counts = countPositions(selectedDetails(spreadsheet, convocationId));
  assert.equal(counts.PO >= 1 && counts.DEF >= 4 && counts.MED >= 4 && counts.DEL >= 3, true, 'P14_E2E_POSITION_MINIMA_ASSERT');

  const approved = runtime.commands.approveConvocation(convocationId, 'coach', { operationId: 'OP-E2E-APPROVE' });
  assert.equal(approved.ESTADO, 'APROBADA', 'P14_E2E_APPROVED_ASSERT');

  const communications = runtime.commands.generateConvocationCommunications(convocationId);
  assert.equal(communications.created.length, 18, 'P14_E2E_COMMUNICATION_ASSERT');
  const sendResults = runtime.commands.sendPendingCommunications({ operationId: 'OP-E2E-SEND' });
  assert.equal(sendResults.length, 18, 'P14_E2E_COMMUNICATION_ASSERT');
  assert.equal(sentMessages.length, 18, 'P14_E2E_COMMUNICATION_ASSERT');
  assert.equal(runtime.queries.getCommunications().every((row) => row.ESTADO === 'ENVIADO'), true, 'P14_E2E_COMMUNICATION_ASSERT');

  const played = runtime.commands.markMatchPlayed(matchRow.PARTIDO_ID, { golesFavor: 2, golesContra: 1 }, 'coach', { operationId: 'OP-E2E-PLAYED' });
  assert.equal(played.ESTADO, 'JUGADO');

  selectedDetails(spreadsheet, convocationId).forEach((row, index) => {
    runtime.commands.createParticipation({
      PARTIDO_ID: matchRow.PARTIDO_ID,
      ALUMNO_ID: row.ALUMNO_ID,
      CONVOCATORIA_ID: convocationId,
      ASISTIO: true,
      ASISTENCIA_ESTADO: 'A',
      CONDICION_INICIAL: index < 11 ? 'TITULAR' : 'SUPLENTE',
      MINUTOS_JUGADOS: index < 11 ? 60 : 15,
      GOLES: 0,
      AMARILLAS: 0,
      ROJAS: 0,
      CALIFICACION: 5,
      OBSERVACIONES: ''
    }, { operationId: `OP-E2E-PARTICIPATION-${index + 1}`, actor: 'coach' });
  });
  assert.equal(runtime.queries.getParticipations().filter((row) => row.PARTIDO_ID === matchRow.PARTIDO_ID).length, 18, 'P14_E2E_PARTICIPATION_18_ASSERT');
  assert.equal(runtime.queries.validateMatchParticipationReadiness(matchRow.PARTIDO_ID).ready, true, 'P14_E2E_READINESS_ASSERT');

  assert.equal(runtime.queries.getPanelDashboard().upcomingMatches.length, 0);
  assert.equal(runtime.queries.getPanelAttendance(trainingSession.SESION_ID).rows.length, 20);
  assert.equal(runtime.queries.getPanelConvocation(convocationId).details.length, 20);
  assert.equal(runtime.queries.getPanelParticipation(matchRow.PARTIDO_ID).rows.length, 18);

  const auditText = JSON.stringify(runtime.queries.getEvents());
  assert.equal(auditText.includes('@example.invalid'), false, 'P14_E2E_AUDIT_PRIVACY_ASSERT');
  assert.equal(/(?:\+?\d[\s.-]?){10,}/.test(auditText), false, 'P14_E2E_AUDIT_PRIVACY_ASSERT');
  assert.equal(/medic|lesion/i.test(auditText), false, 'P14_E2E_AUDIT_PRIVACY_ASSERT');

  const attendanceRowsBeforeReplay = JSON.stringify(spreadsheet.sheets.ASISTENCIAS.rows);
  const absenceIdempotent = runtime.commands.resolveAbsence(absence.asistenciaId, 'FJ', { operationId: 'OP-E2E-ABSENCE', actor: 'coach', reason: 'motivo ficticio' });
  assert.equal(absenceIdempotent.idempotent, true, 'P14_E2E_IDEMPOTENCY_ASSERT');
  assert.equal(JSON.stringify(spreadsheet.sheets.ASISTENCIAS.rows), attendanceRowsBeforeReplay, 'P14_E2E_IDEMPOTENCY_ASSERT');

  const matchRowsBeforeReplay = JSON.stringify(spreadsheet.sheets.PARTIDOS.rows);
  const playedIdempotent = runtime.commands.markMatchPlayed(matchRow.PARTIDO_ID, { golesFavor: 2, golesContra: 1 }, 'coach', { operationId: 'OP-E2E-PLAYED' });
  assert.equal(playedIdempotent.idempotent, true, 'P14_E2E_IDEMPOTENCY_ASSERT');
  assert.equal(JSON.stringify(spreadsheet.sheets.PARTIDOS.rows), matchRowsBeforeReplay, 'P14_E2E_IDEMPOTENCY_ASSERT');
});

test('APPS_SCRIPT_CONFIG_REPOSITORY_CONTRACT_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  appendRecords(spreadsheet.sheets.CONFIG, CONFIG_HEADERS, completeConfigRows());
  const repo = createAppsScriptRepositoryFactory({ spreadsheet, createSheetRepository, createConfigRepository }).createRepository('CONFIG');
  assert.equal(typeof repo.get, 'function');
  assert.equal(typeof repo.getAll, 'function');
  assert.equal(repo.get('CONVOCADOS_A').value, '18');
});

test('APPS_SCRIPT_RUNTIME_REAL_FACTORY_BOOTSTRAP_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  appendRecords(spreadsheet.sheets.CONFIG, CONFIG_HEADERS, completeConfigRows());
  const runtime = productionLikeRuntimeFromSpreadsheet(spreadsheet);
  assert.equal(runtime.queries.verifyConfigReady().ready, true);
  assert.equal(runtime.queries.getPanelDashboard().attendanceSummary.expected, 0);
});

test('APPS_SCRIPT_EMPTY_CONFIG_FAIL_CLOSED_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  const runtime = productionLikeRuntimeFromSpreadsheet(spreadsheet);
  assert.throws(() => runtime.queries.getPanelDashboard(), /CONFIG_REQUIRED_KEY_MISSING/);
});

test('FIRST_RUN_CONFIG_NOT_READY_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  assert.throws(() => productionLikeRuntimeFromSpreadsheet(spreadsheet).queries.verifyConfigReady(), /CONFIG_REQUIRED_KEY_MISSING/);
});

test('FIRST_RUN_CONFIG_READY_AFTER_PERSISTED_ROWS_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  appendRecords(spreadsheet.sheets.CONFIG, CONFIG_HEADERS, completeConfigRows({ TEMPORADA: 'P15_SMOKE' }));
  assert.equal(productionLikeRuntimeFromSpreadsheet(spreadsheet).queries.verifyConfigReady().requiredKeys, 25);
});

test('PANEL_SERIALIZATION_DATE_TEST', () => {
  assert.equal(handlers.toPanelSerializable(new Date('2026-02-01T00:00:00Z')), '2026-02-01T00:00:00.000Z');
});

test('PANEL_SERIALIZATION_NESTED_DATE_TEST', () => {
  assert.equal(handlers.toPanelSerializable({ nested: [{ at: new Date('2026-02-01T00:00:00Z') }] }).nested[0].at, '2026-02-01T00:00:00.000Z');
});

test('PANEL_SERIALIZATION_NO_DATE_INSTANCE_TEST', () => {
  const response = handlers.safePanelResponse(() => ({ at: new Date('2026-02-01T00:00:00Z') }));
  assertPanelSafe(response);
});

test('PANEL_DASHBOARD_GOOGLE_RUN_SAFE_TEST', () => {
  assertPanelSafe(handlers.safePanelResponse(() => createAppsScriptRuntime(runtimeOptions()).queries.getPanelDashboard()));
});

test('PANEL_ATTENDANCE_GOOGLE_RUN_SAFE_TEST', () => {
  assertPanelSafe(handlers.safePanelResponse(() => createAppsScriptRuntime(runtimeOptions()).queries.getPanelAttendance('SES-001')));
});

test('PANEL_PARTICIPATION_GOOGLE_RUN_SAFE_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  assertPanelSafe(handlers.safePanelResponse(() => createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001')));
});

test('PANEL_BOOLEAN_FAIL_CLOSED_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  options.repositories.detailRepository = createArrayRepository([detail({ SELECCIONADO_FINAL: 'YES' })]);
  assert.throws(() => createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001'), /BOOLEAN/);
});

test('PANEL_MULTIPLE_AUTHORITATIVE_CONVOCATIONS_TEST', () => {
  const options = runtimeOptions();
  options.repositories.convocationRepository = createArrayRepository([
    convocation(),
    { ...convocation(), CONVOCATORIA_ID: 'CON-002', ESTADO: 'ENVIADA' }
  ]);
  assert.throws(() => createAppsScriptRuntime(options).queries.getPanelDashboard(), /PANEL_MULTIPLE_AUTHORITATIVE_CONVOCATIONS/);
});

test('PANEL_ATTENDANCE_ID_AVAILABLE_TEST', () => {
  const options = runtimeOptions();
  options.repositories.attendanceRepository = createArrayRepository([{ ASISTENCIA_ID: 'AST-001', SESION_ID: 'SES-001', ALUMNO_ID: 'ALU-001', ESTADO: 'F' }]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelAttendance('SES-001').rows[0].attendanceId, 'AST-001');
});

test('PANEL_ATTENDANCE_VIEW_SCOPED_GENERAL_TEST', () => {
  const options = runtimeOptions();
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-A', COMPETENCIA_BASE: 'A' }), student({ ALUMNO_ID: 'ALU-B', COMPETENCIA_BASE: 'B' })]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelAttendance('SES-001').rows.length, 2);
});

test('PANEL_ATTENDANCE_VIEW_SCOPED_A_TEST', () => {
  const options = runtimeOptions();
  options.repositories.sessionRepository = createArrayRepository([session({ COMPETENCIA: 'A' })]);
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-A', COMPETENCIA_BASE: 'A' }), student({ ALUMNO_ID: 'ALU-B', COMPETENCIA_BASE: 'B' })]);
  assert.deepEqual(createAppsScriptRuntime(options).queries.getPanelAttendance('SES-001').rows.map((row) => row.studentId), ['ALU-A']);
});

test('PANEL_ATTENDANCE_VIEW_SCOPED_B_TEST', () => {
  const options = runtimeOptions();
  options.repositories.sessionRepository = createArrayRepository([session({ COMPETENCIA: 'B' })]);
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-A', COMPETENCIA_BASE: 'A' }), student({ ALUMNO_ID: 'ALU-B', COMPETENCIA_BASE: 'B' })]);
  assert.deepEqual(createAppsScriptRuntime(options).queries.getPanelAttendance('SES-001').rows.map((row) => row.studentId), ['ALU-B']);
});

test('PANEL_ATTENDANCE_VIEW_INACTIVE_EXCLUDED_TEST', () => {
  const options = runtimeOptions();
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-A' }), student({ ALUMNO_ID: 'ALU-X', ACTIVO: false })]);
  assert.deepEqual(createAppsScriptRuntime(options).queries.getPanelAttendance('SES-001').rows.map((row) => row.studentId), ['ALU-A']);
});

test('PANEL_ATTENDANCE_VIEW_ORDER_INVARIANT_TEST', () => {
  const options = runtimeOptions();
  options.repositories.studentRepository = createArrayRepository([
    student({ ALUMNO_ID: 'ALU-2', NOMBRE: 'Beto', APELLIDOS: 'Zeta', GRUPO: 'B' }),
    student({ ALUMNO_ID: 'ALU-1', NOMBRE: 'Ana', APELLIDOS: 'Alfa', GRUPO: 'A' })
  ]);
  assert.deepEqual(createAppsScriptRuntime(options).queries.getPanelAttendance('SES-001').rows.map((row) => row.studentId), ['ALU-1', 'ALU-2']);
});

test('PANEL_POSTMATCH_ATTENDANCE_DERIVED_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ SESION_ID: 'SES-MATCH', TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  options.repositories.attendanceRepository = createArrayRepository([{ ASISTENCIA_ID: 'AST-MATCH', SESION_ID: 'SES-MATCH', ALUMNO_ID: 'ALU-001', ESTADO: 'R' }]);
  const row = createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001').rows[0];
  assert.equal(row.ASISTENCIA_ESTADO, 'R');
  assert.equal(row.ASISTIO_DERIVADO, true);
  assert.equal(row.attendanceId, 'AST-MATCH');
});

test('PANEL_POSTMATCH_MISSING_ATTENDANCE_ISSUE_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ SESION_ID: 'SES-MATCH', TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  const view = createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001');
  assert.equal(view.issues.some((issue) => issue.code === 'PANEL_POSTMATCH_ATTENDANCE_REQUIRED'), true);
});

test('PANEL_POSTMATCH_SELECTED_ONLY_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ ESTADO: 'JUGADO', GOLES_FAVOR: 1, GOLES_CONTRA: 0 })]);
  options.repositories.sessionRepository = createArrayRepository([session({ TIPO: 'PARTIDO', COMPETENCIA: 'A', PARTIDO_ID: 'PAR-001' })]);
  options.repositories.studentRepository = createArrayRepository([student({ ALUMNO_ID: 'ALU-001' }), student({ ALUMNO_ID: 'ALU-002' })]);
  options.repositories.detailRepository = createArrayRepository([detail({ ALUMNO_ID: 'ALU-001' }), detail({ DETALLE_ID: 'DET-002', ALUMNO_ID: 'ALU-002', SELECCIONADO_FINAL: false })]);
  assert.deepEqual(createAppsScriptRuntime(options).queries.getPanelParticipation('PAR-001').rows.map((row) => row.ALUMNO_ID), ['ALU-001']);
});

test('PANEL_DASHBOARD_NO_PROGRAMMED_MATCH_NOT_PLAYED_NOISE_TEST', () => {
  assert.equal(createAppsScriptRuntime(runtimeOptions()).queries.getPanelDashboard().readinessIssues.length, 0);
});

test('PANEL_NEXT_MATCH_A_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ PARTIDO_ID: 'PAR-B', COMPETENCIA: 'B' }), match({ PARTIDO_ID: 'PAR-A', COMPETENCIA: 'A' })]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().nextMatchA.partidoId, 'PAR-A');
});

test('PANEL_NEXT_MATCH_B_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([match({ PARTIDO_ID: 'PAR-A', COMPETENCIA: 'A' }), match({ PARTIDO_ID: 'PAR-B', COMPETENCIA: 'B' })]);
  assert.equal(createAppsScriptRuntime(options).queries.getPanelDashboard().nextMatchB.partidoId, 'PAR-B');
});

test('PANEL_MATCH_ORDER_INVARIANT_TEST', () => {
  const options = runtimeOptions();
  options.repositories.matchRepository = createArrayRepository([
    match({ PARTIDO_ID: 'PAR-2', FECHA: '2026-03-01', HORA_PARTIDO: '10:00' }),
    match({ PARTIDO_ID: 'PAR-1', FECHA: '2026-02-01', HORA_PARTIDO: '10:00' })
  ]);
  assert.deepEqual(createAppsScriptRuntime(options).queries.getPanelDashboard().upcomingMatches.map((row) => row.partidoId), ['PAR-1', 'PAR-2']);
});

test('PANEL_REFERENCE_DATA_TEST', () => {
  const data = createAppsScriptRuntime(runtimeOptions()).queries.getPanelReferenceData();
  assert.equal(Array.isArray(data.openSessions), true);
  assert.equal(Array.isArray(data.programmedMatches), true);
  assert.deepEqual(data.runtimeCapabilities, { externalMailEnabled: true });
});

test('SESSION_SERVICE_DATE_OBJECT_INPUT_TEST', () => {
  const options = runtimeOptions();
  const created = createAppsScriptRuntime(options).commands.createSession({
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-02-02',
    HORA_INICIO: new Date(2000, 0, 1, 16, 0, 0, 0),
    HORA_FIN: new Date(2000, 0, 1, 17, 30, 0, 0),
    COMPETENCIA: 'GENERAL'
  });

  assert.equal(created.HORA_INICIO, '16:00');
  assert.equal(created.HORA_FIN, '17:30');
  assert.equal(options.repositories.sessionRepository.getAll().filter((row) => row.SESION_ID === 'SES-NEW')[0].HORA_INICIO, '16:00');
  assert.equal(options.repositories.sessionRepository.getAll().filter((row) => row.SESION_ID === 'SES-NEW')[0].HORA_FIN, '17:30');
});

test('TIME_LEGACY_STRING_CONCAT_REMOVED_TEST', () => {
  [
    'src/services/AttendanceFoundationService.js',
    'src/services/SessionService.js',
    'src/services/MatchService.js'
  ].forEach((fileName) => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', fileName), 'utf8');
    assert.equal(source.includes("1970-01-01T' +"), false);
    assert.equal(source.includes('1970-01-01T" +'), false);
  });
});

test('PANEL_REFERENCE_DATA_PII_TEST', () => {
  const data = createAppsScriptRuntime(runtimeOptions()).queries.getPanelReferenceData();
  assert.equal(JSON.stringify(data).includes('family@example.invalid'), false);
});

test('PANEL_APPROVAL_BACKEND_STILL_FAILS_CLOSED_TEST', () => {
  const runtime = createAppsScriptRuntime(runtimeOptions());
  assert.throws(() => runtime.commands.approveConvocation('CON-001', ''), /CONVOCATION_APPROVAL_ACTOR_REQUIRED/);
});

function captureRpcController() {
  const calls = [];
  const controller = createPanelClientController({
    callServer(name, args, onSuccess, onFailure) {
      calls.push({ name, args, hasSuccess: typeof onSuccess === 'function', hasFailure: typeof onFailure === 'function' });
      onSuccess({ ok: true, data: {} });
    },
    state: { referenceData: { runtimeCapabilities: { externalMailEnabled: true }, openSessions: [{ sesionId: 'SES-001' }] } }
  });
  return { calls, controller };
}

function errorCaptureController(response) {
  const errors = [];
  const controller = createPanelClientController({
    callServer(name, args, onSuccess) {
      onSuccess(response);
    },
    render: {
      error(message) {
        errors.push(message);
      }
    }
  });
  return { controller, errors };
}

test('PANEL_CLIENT_ATTENDANCE_LOAD_SESSION_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.loadAttendance('SES-001');
  assert.deepEqual(calls[0], { name: 'getPanelAttendance', args: ['SES-001'], hasSuccess: true, hasFailure: true });
});

test('PANEL_CLIENT_ATTENDANCE_MARK_A_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.markAttendance('SES-001', 'ALU-001', 'A');
  assert.equal(calls[0].name, 'commandCreateAttendance');
  assert.deepEqual(calls[0].args[0], { sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' });
});

test('PANEL_CLIENT_ATTENDANCE_MARK_R_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.markAttendance('SES-001', 'ALU-001', 'R');
  assert.equal(calls[0].args[0].estado, 'R');
});

test('PANEL_CLIENT_ATTENDANCE_MARK_F_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.markAttendance('SES-001', 'ALU-001', 'F');
  assert.equal(calls[0].args[0].estado, 'F');
});

test('PANEL_CLIENT_ABSENCE_USES_ATTENDANCE_ID_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.resolveAbsence('AST-001', 'FJ', 'motivo');
  assert.deepEqual(calls[0].args, ['AST-001', 'FJ', { reason: 'motivo' }]);
});

test('PANEL_CLIENT_ABSENCE_FJ_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.resolveAbsence('AST-001', 'FJ');
  assert.equal(calls[0].args[1], 'FJ');
});

test('PANEL_CLIENT_ABSENCE_LES_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.resolveAbsence('AST-001', 'LES');
  assert.equal(calls[0].args[1], 'LES');
});

test('PANEL_CLIENT_NO_FI_TEST', () => {
  assert.throws(() => captureRpcController().controller.resolveAbsence('AST-001', 'FI'), /PANEL_CLIENT_ABSENCE_TARGET_REJECTED/);
});

test('PANEL_CLIENT_MATCH_CREATE_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.createMatch({ rival: 'Rival Ficticio' });
  assert.equal(calls[0].name, 'commandCreateMatch');
});

test('PANEL_CLIENT_MATCH_UPDATE_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.updateMatch('PAR-001', { sede: 'Cancha' });
  assert.deepEqual(calls[0].args, ['PAR-001', { sede: 'Cancha' }]);
});

test('PANEL_CLIENT_MATCH_PLAYED_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.markMatchPlayed('PAR-001', { golesFavor: 1, golesContra: 0 });
  assert.equal(calls[0].name, 'commandMarkMatchPlayed');
});

test('PANEL_CLIENT_MATCH_CANCEL_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.cancelMatch('PAR-001');
  assert.deepEqual(calls[0].args, ['PAR-001']);
});

test('PANEL_CLIENT_CONVOCATION_GENERATE_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.generateConvocation('PAR-001');
  assert.deepEqual(calls[0], { name: 'commandGenerateConvocation', args: ['PAR-001'], hasSuccess: true, hasFailure: true });
});

test('PANEL_CLIENT_CONVOCATION_LOAD_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.loadConvocation('CON-001');
  assert.equal(calls[0].name, 'getPanelConvocation');
});

test('PANEL_CLIENT_SELECTION_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.setFinalSelection('CON-001', 'ALU-001', true, 'motivo');
  assert.equal(calls[0].name, 'commandSetFinalSelection');
});

test('PANEL_CLIENT_POSITION_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.assignPosition('CON-001', 'ALU-001', 'DEF', 'motivo');
  assert.equal(calls[0].name, 'commandAssignPosition');
});

test('PANEL_CLIENT_APPROVAL_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.approveConvocation('CON-001', 'COACH_TEST');
  assert.equal(calls[0].name, 'commandApproveConvocation');
});

test('PANEL_CLIENT_APPROVAL_ACTOR_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.approveConvocation('CON-001', 'COACH_TEST');
  assert.deepEqual(calls[0], { name: 'commandApproveConvocation', args: ['CON-001', 'COACH_TEST'], hasSuccess: true, hasFailure: true });
});

test('PANEL_CLIENT_PREPARE_COMMUNICATIONS_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.prepareConvocationCommunications('CON-001');
  assert.equal(calls[0].name, 'commandPrepareConvocationCommunications');
});

test('PANEL_CLIENT_MAIL_CAPABILITY_TEST', () => {
  const calls = [];
  const controller = createPanelClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state: { referenceData: { runtimeCapabilities: { externalMailEnabled: false } } }
  });
  assert.throws(() => controller.sendPendingCommunications(), /PANEL_CLIENT_MAIL_DISABLED/);
  assert.equal(calls.length, 0);
});

test('PANEL_CLIENT_POSTMATCH_SAVE_RPC_TEST', () => {
  const { calls, controller } = captureRpcController();
  controller.saveParticipation('PAR-001', 'ALU-001', { MINUTOS_JUGADOS: 60, ASISTENCIA_ESTADO: 'F' });
  assert.deepEqual(calls[0].args, ['PAR-001', 'ALU-001', { MINUTOS_JUGADOS: 60, ASISTENCIA_ESTADO: 'F' }]);
});

test('PANEL_CLIENT_POSTMATCH_ATTENDANCE_READ_ONLY_TEST', () => {
  const html = getLdvPanelHtml();
  assert.equal(html.includes('ASISTENCIA_ESTADO es lectura'), true);
});

test('PANEL_CLIENT_RPC_FAILURE_HANDLER_TEST', () => {
  let failure;
  createPanelClientController({
    callServer(name, args, onSuccess, onFailure) { failure = onFailure; },
    render: { error(message) { assert.equal(message, 'No se pudo completar la operacion solicitada.'); } }
  }).loadDashboard();
  assert.equal(typeof failure, 'function');
  failure(new Error('STACK family@example.invalid'));
});

test('PANEL_CLIENT_SAFE_ERROR_CODE_VISIBLE_TEST', () => {
  const { controller, errors } = errorCaptureController({
    ok: false,
    code: 'REQUIRED_FIELD',
    message: 'No se pudo completar la operacion solicitada.'
  });

  controller.loadDashboard();

  assert.equal(errors[0], 'No se pudo completar la operacion solicitada. [REQUIRED_FIELD]');
});

test('PANEL_CLIENT_ERROR_DETAIL_NOT_VISIBLE_TEST', () => {
  const { controller, errors } = errorCaptureController({
    ok: false,
    code: 'REQUIRED_FIELD',
    message: 'No se pudo completar la operacion solicitada. family@example.invalid',
    detail: 'token SECRET_TOKEN C:\\Users\\danie\\private',
    stack: 'STACK line with ALU-001 and family@example.invalid'
  });

  controller.loadDashboard();

  assert.equal(errors[0], 'No se pudo completar la operacion solicitada. [REQUIRED_FIELD]');
  assert.equal(errors[0].includes('family@example.invalid'), false);
  assert.equal(errors[0].includes('SECRET_TOKEN'), false);
  assert.equal(errors[0].includes('C:\\Users'), false);
  assert.equal(errors[0].includes('ALU-001'), false);
});

test('PANEL_CLIENT_UNSAFE_CODE_REJECTED_TEST', () => {
  ['ERROR: detail', '<script>', 'user@example.invalid', 'ERROR ' + ['123', '456', '789', '012', '3'].join('')].forEach((code) => {
    const { controller, errors } = errorCaptureController({
      ok: false,
      code,
      message: 'No se pudo completar la operacion solicitada.'
    });

    controller.loadDashboard();

    assert.equal(errors[0], 'No se pudo completar la operacion solicitada.');
  });
});

test('PANEL_CLIENT_ERROR_CLEARED_AFTER_SUCCESS_TEST', () => {
  const errors = [];
  let callCount = 0;
  const controller = createPanelClientController({
    callServer(name, args, onSuccess) {
      callCount += 1;
      if (callCount === 1) {
        onSuccess({ ok: false, code: 'REQUIRED_FIELD', message: 'No se pudo completar la operacion solicitada.' });
        return;
      }
      onSuccess({ ok: true, data: {} });
    },
    render: {
      error(message) {
        errors.push(message);
      }
    }
  });

  controller.loadDashboard();
  controller.loadDashboard();

  assert.equal(errors[0], 'No se pudo completar la operacion solicitada. [REQUIRED_FIELD]');
  assert.equal(errors[1], '');
});

test('PANEL_CONVOCATION_SUCCESS_CLEARS_PREVIOUS_ERROR_TEST', () => {
  const errors = [];
  const html = [];
  const state = {};
  let controller;
  controller = createPanelClientController({
    callServer(name, args, onSuccess) {
      if (name === 'getPanelDashboard') {
        onSuccess({ ok: false, code: 'REQUIRED_FIELD', message: 'No se pudo completar la operacion solicitada.' });
        return;
      }
      onSuccess({
        ok: true,
        data: {
          openSessions: [],
          programmedMatches: [],
          playedMatches: [],
          runtimeCapabilities: { externalMailEnabled: false }
        }
      });
    },
    state,
    render: {
      error(message) {
        errors.push(message);
      },
      referenceData() {
        html.push(createPanelRenderer({ state, controller: controller }).renderConvocations());
      }
    }
  });

  controller.loadDashboard();
  controller.loadReferenceData();

  assert.equal(errors[0], 'No se pudo completar la operacion solicitada. [REQUIRED_FIELD]');
  assert.equal(errors[1], '');
  assert.equal(html[0].includes('Sin propuesta'), true);
  assert.equal(html[0].includes('Aprobado por'), true);
});

test('PANEL_TEST_SEAM_NOT_PUBLIC_RPC_TEST', () => {
  assert.equal(typeof handlers.setPanelRuntimeFactoryForTest_, 'function');
  assert.equal(String(getLdvPanelHtml()).includes('setPanelRuntimeFactoryForTest'), false);
});

test('PANEL_SAVE_PARTICIPATION_DERIVES_CONVOCATION_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: { getPanelParticipation: () => ({ rows: [{ ALUMNO_ID: 'ALU-001', CONVOCATORIA_ID: 'CON-SERVER', ASISTENCIA_ESTADO: 'A', ASISTIO_DERIVADO: true, PARTICIPACION_ID: '' }] }) },
    commands: { createParticipation(input) { assert.equal(input.CONVOCATORIA_ID, 'CON-SERVER'); return input; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandSaveParticipation('PAR-001', 'ALU-001', { CONVOCATORIA_ID: 'CON-CLIENT', MINUTOS_JUGADOS: 1, GOLES: 0, AMARILLAS: 0, ROJAS: 0 }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_SAVE_PARTICIPATION_DERIVES_ATTENDANCE_STATE_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: { getPanelParticipation: () => ({ rows: [{ ALUMNO_ID: 'ALU-001', CONVOCATORIA_ID: 'CON-001', ASISTENCIA_ESTADO: 'R', ASISTIO_DERIVADO: true, PARTICIPACION_ID: '' }] }) },
    commands: { createParticipation(input) { assert.equal(input.ASISTENCIA_ESTADO, 'R'); return input; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandSaveParticipation('PAR-001', 'ALU-001', { ASISTENCIA_ESTADO: 'F' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_SAVE_PARTICIPATION_DERIVES_ASISTIO_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: { getPanelParticipation: () => ({ rows: [{ ALUMNO_ID: 'ALU-001', CONVOCATORIA_ID: 'CON-001', ASISTENCIA_ESTADO: 'F', ASISTIO_DERIVADO: false, PARTICIPACION_ID: '' }] }) },
    commands: { createParticipation(input) { assert.equal(input.ASISTIO, false); return input; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandSaveParticipation('PAR-001', 'ALU-001', { ASISTIO: true }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_SAVE_PARTICIPATION_CLIENT_STATE_IGNORED_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: { getPanelParticipation: () => ({ rows: [{ ALUMNO_ID: 'ALU-001', CONVOCATORIA_ID: 'CON-001', ASISTENCIA_ESTADO: 'A', ASISTIO_DERIVADO: true, PARTICIPACION_ID: '' }] }) },
    commands: { createParticipation(input) { assert.equal(input.PARTICIPACION_ID, undefined); return input; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandSaveParticipation('PAR-001', 'ALU-001', { PARTICIPACION_ID: 'PRT-CLIENT' }).ok, true);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_SAVE_PARTICIPATION_CREATE_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: { getPanelParticipation: () => ({ rows: [{ ALUMNO_ID: 'ALU-001', CONVOCATORIA_ID: 'CON-001', ASISTENCIA_ESTADO: 'A', ASISTIO_DERIVADO: true, PARTICIPACION_ID: '' }] }) },
    commands: { createParticipation(input) { return { created: input.ALUMNO_ID }; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandSaveParticipation('PAR-001', 'ALU-001', {}).data.created, 'ALU-001');
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('PANEL_SAVE_PARTICIPATION_UPDATE_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: { getPanelParticipation: () => ({ rows: [{ ALUMNO_ID: 'ALU-001', CONVOCATORIA_ID: 'CON-001', ASISTENCIA_ESTADO: 'A', ASISTIO_DERIVADO: true, PARTICIPACION_ID: 'PRT-001' }] }) },
    commands: { updateParticipation(id, input) { assert.equal(id, 'PRT-001'); return { updated: input.ALUMNO_ID }; } },
    runtime: { idGenerator: { operationId: () => 'OP-SERVER' } }
  }));
  try {
    assert.equal(handlers.commandSaveParticipation('PAR-001', 'ALU-001', {}).data.updated, 'ALU-001');
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('P14_REAL_BOOTSTRAP_FAKE_SPREADSHEET_TEST', () => {
  const spreadsheet = fakeSpreadsheet();
  setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
  appendRecords(spreadsheet.sheets.CONFIG, CONFIG_HEADERS, completeConfigRows());
  appendRecords(spreadsheet.sheets.ALUMNOS, STUDENT_HEADERS, [student()]);
  appendRecords(spreadsheet.sheets.TUTORES, TUTOR_HEADERS, [tutor()]);
  appendRecords(spreadsheet.sheets.SESIONES, SESSION_HEADERS, [session()]);
  const runtime = productionLikeRuntimeFromSpreadsheet(spreadsheet);
  assert.equal(runtime.queries.getPanelDashboard().attendanceBySession[0].expected, 1);
  runtime.commands.createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' });
  runtime.commands.createMatch({ COMPETENCIA: 'A', JORNADA: 'J2', RIVAL: 'Rival Ficticio', FECHA: '2026-02-02', HORA_PARTIDO: '10:00', SEDE: 'Cancha', LOCAL_VISITANTE: 'LOCAL', DURACION_MINUTOS: 60 }, { operationId: 'OP-MATCH', actor: 'coach' });
  assert.equal(spreadsheet.sheets.PARTIDOS.rows.length, 2);
  assert.equal(spreadsheet.sheets.BITACORA.rows.length > 1, true);
});
