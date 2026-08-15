const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
require('../../src/domain/MatchContracts');
require('../../src/domain/ConvocationContracts');
const { createMatchService } = require('../../src/services/MatchService');
const { createAttendanceMetricsService } = require('../../src/services/AttendanceMetricsService');
require('../../src/domain/AttendanceConfigPolicy');
require('../../src/domain/AttendanceSnapshotValidator');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
const { createConfigService } = require('../../src/config/ConfigService');
const { completeConfigRows } = require('../config/config-fixtures');
const { createEligibilityService } = require('../../src/services/EligibilityService');

function student(overrides = {}) {
  return {
    ALUMNO_ID: 'ALU-001',
    ACTIVO: true,
    COMPETENCIA_BASE: 'A',
    NIVEL: 'A1',
    POSICION_PRINCIPAL: 'DEF',
    POSICION_SECUNDARIA: '',
    ESTADO_DEPORTIVO: 'ACTIVO',
    ...overrides
  };
}

function match(overrides = {}) {
  return {
    PARTIDO_ID: 'PAR-001',
    COMPETENCIA: 'A',
    JORNADA: 'J1',
    RIVAL: 'Rival',
    FECHA: '2026-02-01',
    HORA_CITACION: '09:00',
    HORA_PARTIDO: '10:00',
    SEDE: 'Sede',
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

function attendance(overrides = {}) {
  return {
    ASISTENCIA_ID: 'AST-001',
    ALUMNO_ID: 'ALU-001',
    ESTADO: 'A',
    VALOR_APLICADO: 1,
    VALOR_MAXIMO_APLICADO: 1,
    REGISTRADO_EN: '2026-01-01T10:00:00Z',
    MODIFICADO_EN: '2026-01-01T10:00:00Z',
    ...overrides
  };
}

function service({ students = [student()], matches = [match()], attendances = [], convocations = [], details = [] } = {}) {
  const configService = createConfigService(createConfigRepository(completeConfigRows()));
  const attendanceRepository = createArrayRepository(attendances);
  const matchService = createMatchService({ matchRepository: createArrayRepository(matches), utils });
  const metricsService = createAttendanceMetricsService({ attendanceRepository, configService, utils });

  return createEligibilityService({
    attendanceRepository,
    clock: { now: () => new Date('2026-02-01T08:00:00Z') },
    convocationRepository: createArrayRepository(convocations),
    detailRepository: createArrayRepository(details),
    matchService,
    metricsService,
    studentRepository: createArrayRepository(students),
    utils
  });
}

function firstResult(options) {
  return service(options).evaluateMatch('PAR-001')[0];
}

test('ELIGIBILITY_ACTIVE_TEST marks active in-pool student eligible', () => {
  assert.equal(firstResult().status, 'ELIGIBLE');
});

test('ELIGIBILITY_INACTIVE_TEST blocks inactive students', () => {
  assert.equal(firstResult({ students: [student({ ACTIVO: false })] }).reason, 'STUDENT_INACTIVE');
});

test('ELIGIBILITY_INJURED_TEST blocks current injured students', () => {
  assert.equal(firstResult({ students: [student({ ESTADO_DEPORTIVO: 'LESIONADO' })] }).reason, 'INJURED');
});

test('ELIGIBILITY_SUSPENDED_TEST blocks suspended students', () => {
  assert.equal(firstResult({ students: [student({ ESTADO_DEPORTIVO: 'SUSPENDIDO' })] }).reason, 'SUSPENDED');
});

test('ELIGIBILITY_PENDING_ABSENCE_TEST marks pending absence', () => {
  const result = firstResult({ attendances: [attendance({ ESTADO: 'F', VALOR_APLICADO: null, VALOR_MAXIMO_APLICADO: null })] });
  assert.equal(result.status, 'PENDING');
  assert.equal(result.reason, 'ABSENCE_PENDING');
});

test('ELIGIBILITY_RETARDO_TEST does not block retardo', () => {
  assert.equal(firstResult({ attendances: [attendance({ ESTADO: 'R', VALOR_APLICADO: 0.75, VALOR_MAXIMO_APLICADO: 1 })] }).status, 'ELIGIBLE');
});

test('ELIGIBILITY_FJ_TEST does not block justified absence', () => {
  assert.equal(firstResult({ attendances: [attendance({ ESTADO: 'FJ' })] }).status, 'ELIGIBLE');
});

test('ELIGIBILITY_HISTORICAL_LESION_TEST does not block historical LES attendance', () => {
  assert.equal(firstResult({ attendances: [attendance({ ESTADO: 'LES' })] }).status, 'ELIGIBLE');
});

test('FI_SINGLE_BLOCK_TEST blocks one outstanding FI', () => {
  assert.equal(firstResult({ attendances: [attendance({ ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 })] }).reason, 'FI_BLOCK');
});

test('FI_BLOCK_SOURCE_TEST returns source attendance id', () => {
  const result = firstResult({ attendances: [attendance({ ASISTENCIA_ID: 'AST-FI-1', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 })] });
  assert.equal(result.fiSourceAttendanceId, 'AST-FI-1');
});

test('FI_NOT_CONSUMED_BY_DRAFT_TEST ignores draft details as consumption', () => {
  const result = firstResult({
    attendances: [attendance({ ASISTENCIA_ID: 'AST-FI-1', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 })],
    convocations: [{ CONVOCATORIA_ID: 'CON-1', PARTIDO_ID: 'PAR-001', ESTADO: 'BORRADOR' }],
    details: [{ CONVOCATORIA_ID: 'CON-1', ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'FI_BLOCK', FI_ORIGEN_ID: 'AST-FI-1' }]
  });
  assert.equal(result.reason, 'FI_BLOCK');
});

test('FI_NOT_CONSUMED_BY_PROPOSAL_TEST ignores proposal details as consumption', () => {
  const result = firstResult({
    attendances: [attendance({ ASISTENCIA_ID: 'AST-FI-1', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 })],
    convocations: [{ CONVOCATORIA_ID: 'CON-1', PARTIDO_ID: 'PAR-001', ESTADO: 'PROPUESTA' }],
    details: [{ CONVOCATORIA_ID: 'CON-1', ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'FI_BLOCK', FI_ORIGEN_ID: 'AST-FI-1' }]
  });
  assert.equal(result.reason, 'FI_BLOCK');
});

test('FI_CONSUMED_BY_APPROVED_TEST consumes approved FI evidence', () => {
  const result = firstResult({
    attendances: [attendance({ ASISTENCIA_ID: 'AST-FI-1', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 })],
    convocations: [{ CONVOCATORIA_ID: 'CON-1', PARTIDO_ID: 'PAR-001', ESTADO: 'APROBADA' }],
    details: [{ CONVOCATORIA_ID: 'CON-1', ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'FI_BLOCK', FI_ORIGEN_ID: 'AST-FI-1' }]
  });
  assert.equal(result.status, 'ELIGIBLE');
});

test('FI_CANCELLED_MATCH_NOT_CONSUMED_TEST ignores consumption on cancelled match', () => {
  const result = firstResult({
    attendances: [attendance({ ASISTENCIA_ID: 'AST-FI-1', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 })],
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', ESTADO: 'CANCELADO' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-1', PARTIDO_ID: 'PAR-OLD', ESTADO: 'APROBADA' }],
    details: [{ CONVOCATORIA_ID: 'CON-1', ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'FI_BLOCK', FI_ORIGEN_ID: 'AST-FI-1' }]
  });
  assert.equal(result.reason, 'FI_BLOCK');
});

test('FI_TWO_OUTSTANDING_BLOCKS_TEST consumes only one FI per approved block', () => {
  const result = firstResult({
    attendances: [
      attendance({ ASISTENCIA_ID: 'AST-FI-1', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' }),
      attendance({ ASISTENCIA_ID: 'AST-FI-2', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-02T10:00:00Z' })
    ],
    convocations: [{ CONVOCATORIA_ID: 'CON-1', PARTIDO_ID: 'PAR-001', ESTADO: 'APROBADA' }],
    details: [{ CONVOCATORIA_ID: 'CON-1', ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'FI_BLOCK', FI_ORIGEN_ID: 'AST-FI-1' }]
  });
  assert.equal(result.fiSourceAttendanceId, 'AST-FI-2');
});

test('FI_OLDEST_FIRST_TEST uses oldest outstanding FI first', () => {
  const result = firstResult({
    attendances: [
      attendance({ ASISTENCIA_ID: 'AST-FI-2', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-02T10:00:00Z' }),
      attendance({ ASISTENCIA_ID: 'AST-FI-1', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' })
    ]
  });
  assert.equal(result.fiSourceAttendanceId, 'AST-FI-1');
});

test('ELIGIBILITY_COMPETITION_POOL_TEST evaluates only competition base pool', () => {
  assert.equal(service({ students: [student({ COMPETENCIA_BASE: 'B' })] }).evaluateMatch('PAR-001').length, 0);
});

test('ELIGIBILITY_NO_SCORE_THRESHOLD_TEST low compliance does not block eligibility', () => {
  assert.equal(firstResult({ attendances: [attendance({ ESTADO: 'FI', ASISTENCIA_ID: 'AST-OLD', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 })] }).reason, 'FI_BLOCK');
  assert.equal(firstResult({ attendances: [attendance({ ESTADO: 'R', VALOR_APLICADO: 0.1, VALOR_MAXIMO_APLICADO: 1 })] }).status, 'ELIGIBLE');
});
