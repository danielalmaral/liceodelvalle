const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
const { createConfigService } = require('../../src/config/ConfigService');
require('../../src/domain/MatchContracts');
const { createMatchService } = require('../../src/services/MatchService');
const { createRotationService } = require('../../src/services/RotationService');
const { completeConfigRows } = require('../config/config-fixtures');

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

function convocation(overrides = {}) {
  return { CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA', ...overrides };
}

function detail(overrides = {}) {
  return {
    CONVOCATORIA_ID: 'CON-001',
    ALUMNO_ID: 'ALU-001',
    COMPETENCIA_SNAPSHOT: 'A',
    ELEGIBILITY_STATUS: 'ELIGIBLE',
    SELECCIONADO_FINAL: false,
    ...overrides
  };
}

function service({ configOverrides = {}, matches = [match()], convocations = [], details = [] } = {}) {
  const configService = createConfigService(createConfigRepository(completeConfigRows(configOverrides)));
  const matchService = createMatchService({ matchRepository: createArrayRepository(matches), utils });

  return createRotationService({
    configService,
    convocationRepository: createArrayRepository(convocations),
    detailRepository: createArrayRepository(details),
    matchService,
    utils
  });
}

test('ROTATION_INITIAL_ZERO_TEST starts at zero', () => {
  assert.equal(service().getRotationBefore('ALU-001', 'A'), 0);
});

test('ROTATION_SELECTED_RESETS_TEST selected final resets debt', () => {
  assert.equal(service({ convocations: [convocation()], details: [detail({ SELECCIONADO_FINAL: true })] }).getRotationBefore('ALU-001', 'A'), 0);
});

test('ROTATION_ELIGIBLE_NOT_SELECTED_INCREMENT_TEST increments eligible unselected', () => {
  assert.equal(service({ convocations: [convocation()], details: [detail()] }).getRotationBefore('ALU-001', 'A'), 1);
});

test('ROTATION_INELIGIBLE_UNCHANGED_TEST does not increment ineligible', () => {
  assert.equal(service({ convocations: [convocation()], details: [detail({ ELEGIBILITY_STATUS: 'INELIGIBLE' })] }).getRotationBefore('ALU-001', 'A'), 0);
});

test('ROTATION_PENDING_UNCHANGED_TEST does not increment pending', () => {
  assert.equal(service({ convocations: [convocation()], details: [detail({ ELEGIBILITY_STATUS: 'PENDING' })] }).getRotationBefore('ALU-001', 'A'), 0);
});

test('ROTATION_CANCELLED_MATCH_IGNORED_TEST ignores cancelled matches', () => {
  assert.equal(service({ matches: [match({ ESTADO: 'CANCELADO' })], convocations: [convocation()], details: [detail()] }).getRotationBefore('ALU-001', 'A'), 0);
});

test('ROTATION_COMPETITION_SCOPED_TEST does not carry A debt to B', () => {
  assert.equal(service({ convocations: [convocation()], details: [detail()] }).getRotationBefore('ALU-001', 'B'), 0);
});

test('ROTATION_PRIORITY_CONFIG_TEST respects disabled config', () => {
  assert.equal(service({ configOverrides: { ROTACION_OBLIGATORIA: 'FALSE' } }).isPriority(1), false);
});

test('ROTATION_PRIORITY_THRESHOLD_TEST uses MAX_SIN_CONVOCATORIA', () => {
  assert.equal(service({ configOverrides: { MAX_SIN_CONVOCATORIA: '2' } }).isPriority(1), false);
  assert.equal(service({ configOverrides: { MAX_SIN_CONVOCATORIA: '2' } }).isPriority(2), true);
});

test('ROTATION_NO_SHOW_STILL_RESET_TEST selected final still resets even if later absent', () => {
  assert.equal(service({ convocations: [convocation()], details: [detail({ SELECCIONADO_FINAL: true })] }).previewUpdate({ studentId: 'ALU-001', competition: 'A', status: 'ELIGIBLE' }, true).rotationAfter, 0);
});

test('ROTATION_EXCEPTION_REQUIRES_REASON_TEST requires reason for priority omission', () => {
  assert.throws(() => service().validatePriorityException({ ALUMNO_ID: 'ALU-001', PRIORIDAD_ROTACION: true, SELECCIONADO_FINAL: false, ROTATION_EXCEPTION: false, MOTIVO_CAMBIO: '' }), /ROTATION_EXCEPTION_REASON_REQUIRED/);
});

test('ROTATION_DRAFT_IGNORED_TEST ignores draft convocations', () => {
  assert.equal(service({ convocations: [convocation({ ESTADO: 'BORRADOR' })], details: [detail()] }).getRotationBefore('ALU-001', 'A'), 0);
});
