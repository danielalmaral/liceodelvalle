const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
require('../../src/domain/AttendanceContracts');
const { createConfigService } = require('../../src/config/ConfigService');
const { createAttendanceFoundationService } = require('../../src/services/AttendanceFoundationService');
const { createAttendanceMetricsService } = require('../../src/services/AttendanceMetricsService');
const { completeConfigRows } = require('../config/config-fixtures');

function config(overrides = {}) {
  return createConfigService(createConfigRepository(completeConfigRows(overrides)));
}

function row(status, value, max, overrides = {}) {
  return {
    ASISTENCIA_ID: `AST-${Math.random()}`,
    SESION_ID: 'SES-001',
    ALUMNO_ID: 'ALU-001',
    ESTADO: status,
    VALOR_APLICADO: value,
    VALOR_MAXIMO_APLICADO: max,
    ...overrides
  };
}

function metrics(rows, configService = config()) {
  return createAttendanceMetricsService({
    attendanceRepository: createArrayRepository(rows),
    configService,
    utils
  });
}

function capture(configService) {
  return createAttendanceFoundationService({
    attendanceRepository: createArrayRepository([]),
    clock: { now: () => new Date('2026-01-02T10:00:00Z') },
    configService,
    idGenerator: { attendanceId: () => 'AST-NEW' },
    sessionRepository: createArrayRepository([{ SESION_ID: 'SES-001', TIPO: 'ENTRENAMIENTO', FECHA: '2026-01-02', HORA_INICIO: '', HORA_FIN: '', COMPETENCIA: 'GENERAL', PARTIDO_ID: '', DESCRIPCION: '', ESTADO: 'ABIERTA' }]),
    studentRepository: createArrayRepository([{ ALUMNO_ID: 'ALU-001' }]),
    utils
  });
}

test('ATTENDANCE_CONFIG_RELATION_TEST validates functional attendance config relations', () => {
  assert.equal(metrics([]).validateAttendanceConfigRelations(), true);
  assert.throws(() => metrics([], config({ RETARDO_VALOR: '1.2' })).validateAttendanceConfigRelations(), /ATTENDANCE_CONFIG_RELATION_INVALID/);
});

test('COMPLIANCE_PERFECT_TEST returns 100 for perfect snapshots', () => {
  assert.equal(metrics([row('A', 1, 1), row('FJ', 1, 1), row('LES', 1, 1)]).getStudentMetrics('ALU-001').compliancePercentage, 100);
});

test('COMPLIANCE_LATE_TEST uses late penalty snapshot', () => {
  assert.equal(metrics([row('A', 1, 1), row('R', 0.75, 1)]).getStudentMetrics('ALU-001').compliancePercentage, 87.5);
});

test('COMPLIANCE_UNJUSTIFIED_ABSENCE_TEST penalizes FI by snapshot', () => {
  assert.equal(metrics([row('A', 1, 1), row('FI', 0, 1)]).getStudentMetrics('ALU-001').compliancePercentage, 50);
});

test('COMPLIANCE_JUSTIFIED_NO_PENALTY_TEST keeps FJ at max value', () => {
  assert.equal(metrics([row('FJ', 1, 1)]).getStudentMetrics('ALU-001').compliancePercentage, 100);
});

test('COMPLIANCE_INJURY_NO_PENALTY_TEST keeps LES at max value', () => {
  assert.equal(metrics([row('LES', 1, 1)]).getStudentMetrics('ALU-001').compliancePercentage, 100);
});

test('COMPLIANCE_PENDING_EXCLUDED_TEST excludes F and marks provisional', () => {
  const result = metrics([row('A', 1, 1), row('F', null, null)]).getStudentMetrics('ALU-001');
  assert.equal(result.compliancePercentage, 100);
  assert.equal(result.status, 'PROVISIONAL');
});

test('COMPLIANCE_NO_DATA_TEST returns NO_DATA instead of 100', () => {
  assert.equal(metrics([]).getStudentMetrics('ALU-001').status, 'NO_DATA');
});

test('PHYSICAL_PRESENCE_TEST separates physical presence from compliance', () => {
  const result = metrics([row('A', 1, 1), row('FJ', 1, 1), row('LES', 1, 1)]).getStudentMetrics('ALU-001');
  assert.equal(result.compliancePercentage, 100);
  assert.ok(Math.abs(result.physicalPresencePercentage - (100 / 3)) < 0.000001);
});

test('HISTORICAL_VALUE_SNAPSHOT_TEST keeps old retardo value after config changes', () => {
  const first = capture(config({ RETARDO_VALOR: '0.75' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'R' });
  const second = capture(config({ RETARDO_VALOR: '0.80' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'R' });
  assert.equal(first.VALOR_APLICADO, 0.75);
  assert.equal(second.VALOR_APLICADO, 0.8);
});

test('HISTORICAL_MAX_VALUE_SNAPSHOT_TEST keeps old max value after config changes', () => {
  const first = capture(config({ ASISTENCIA_VALOR: '1' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'R' });
  const second = capture(config({ ASISTENCIA_VALOR: '2', RETARDO_VALOR: '0.75' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'R' });
  assert.equal(first.VALOR_MAXIMO_APLICADO, 1);
  assert.equal(second.VALOR_MAXIMO_APLICADO, 2);
});

test('DYNAMIC_CONFIG_NEW_EVENT_TEST new captures use current config values', () => {
  const first = capture(config({ RETARDO_VALOR: '0.75' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'R' });
  const second = capture(config({ RETARDO_VALOR: '0.80' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'R' });
  assert.notEqual(first.VALOR_APLICADO, second.VALOR_APLICADO);
});
