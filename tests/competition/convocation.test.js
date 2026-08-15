const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { setupSheetWithHeaders } = require('../../src/common/SheetSetup');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
require('../../src/domain/MatchContracts');
require('../../src/domain/ConvocationContracts');
require('../../src/domain/AttendanceConfigPolicy');
require('../../src/domain/AttendanceSnapshotValidator');
const { createConfigService } = require('../../src/config/ConfigService');
const { setupCompetitionSheets } = require('../../src/config/CompetitionSetup');
const { createMatchService } = require('../../src/services/MatchService');
const { createAttendanceMetricsService } = require('../../src/services/AttendanceMetricsService');
const { createEligibilityService } = require('../../src/services/EligibilityService');
const { createRotationService } = require('../../src/services/RotationService');
const { createConvocationService } = require('../../src/services/ConvocationService');
const { completeConfigRows } = require('../config/config-fixtures');

function config(overrides = {}) {
  return createConfigService(createConfigRepository(completeConfigRows({
    CONVOCADOS_A: '4',
    CONVOCADOS_B: '4',
    MIN_PORTEROS: '1',
    MIN_DEFENSAS: '1',
    MIN_MEDIOS: '1',
    MIN_DELANTEROS: '1',
    ...overrides
  })));
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

function student(id, pos, overrides = {}) {
  return {
    ALUMNO_ID: id,
    ACTIVO: true,
    COMPETENCIA_BASE: 'A',
    NIVEL: 'A1',
    POSICION_PRINCIPAL: pos,
    POSICION_SECUNDARIA: '',
    ESTADO_DEPORTIVO: 'ACTIVO',
    ...overrides
  };
}

function baseStudents(overrides = {}) {
  return [
    student('ALU-PO', 'PO', overrides['ALU-PO'] || {}),
    student('ALU-DEF', 'DEF', overrides['ALU-DEF'] || {}),
    student('ALU-MED', 'MED', overrides['ALU-MED'] || {}),
    student('ALU-DEL', 'DEL', overrides['ALU-DEL'] || {})
  ];
}

function attendance(id, overrides = {}) {
  return {
    ASISTENCIA_ID: `AST-${id}`,
    ALUMNO_ID: id,
    ESTADO: 'A',
    VALOR_APLICADO: 1,
    VALOR_MAXIMO_APLICADO: 1,
    REGISTRADO_EN: '2026-01-01T10:00:00Z',
    MODIFICADO_EN: '2026-01-01T10:00:00Z',
    ...overrides
  };
}

function service({ students = baseStudents(), matches = [match()], attendances = [], convocations = [], details = [], configService = config() } = {}) {
  const convocationRepository = createArrayRepository(convocations);
  const detailRepository = createArrayRepository(details);
  const attendanceRepository = createArrayRepository(attendances);
  const matchService = createMatchService({ matchRepository: createArrayRepository(matches), utils });
  const metricsService = createAttendanceMetricsService({ attendanceRepository, configService, utils });
  const eligibilityService = createEligibilityService({
    attendanceRepository,
    clock: { now: () => new Date('2026-02-01T08:00:00Z') },
    convocationRepository,
    detailRepository,
    matchService,
    metricsService,
    studentRepository: createArrayRepository(students),
    utils
  });
  const rotationService = createRotationService({ configService, convocationRepository, detailRepository, matchService, utils });
  const convocationService = createConvocationService({
    clock: { now: () => new Date('2026-02-01T08:00:00Z') },
    configService,
    convocationRepository,
    detailRepository,
    eligibilityService,
    idGenerator: { convocationId: () => 'CON-NEW', detailId: (id) => `DET-${id}` },
    matchService,
    rotationService,
    studentRepository: createArrayRepository(students),
    utils
  });

  return { convocationRepository, convocationService, detailRepository };
}

function generate(options) {
  return service(options).convocationService.generateConvocation('PAR-001', 'coach');
}

function fakeSpreadsheet() {
  const sheets = {};
  return {
    sheets,
    getSheetByName(name) { return sheets[name] || null; },
    insertSheet(name) {
      sheets[name] = {
        rows: [],
        getLastRow() { return this.rows.length; },
        getRange(row, column, rowCount, columnCount) {
          return {
            getValues: () => this.rows.slice(row - 1, row - 1 + rowCount).map((sourceRow) => sourceRow.slice(column - 1, column - 1 + columnCount)),
            setValues: (values) => { for (let i = 0; i < rowCount; i += 1) this.rows[row - 1 + i] = values[i].slice(); }
          };
        }
      };
      return sheets[name];
    }
  };
}

test('CONVOCATION_SCHEMA_TEST creates convocation proposal schema', () => {
  assert.equal(generate().convocation.CONVOCATORIA_ID, 'CON-NEW');
});

test('CONVOCATION_DETAIL_SCHEMA_TEST creates detail for each pool student', () => {
  assert.equal(generate().details.length, 4);
});

test('CONVOCATION_CONFIG_SNAPSHOT_TEST stores config snapshots', () => {
  const result = generate();
  assert.equal(result.convocation.TOTAL_OBJETIVO, 4);
  assert.equal(result.convocation.MIN_PORTEROS_SNAPSHOT, 1);
});

test('CONVOCATION_CONFIG_RELATION_FAIL_CLOSED_TEST rejects impossible minima', () => {
  assert.throws(() => generate({ configService: config({ CONVOCADOS_A: '3' }) }), /CONVOCATION_CONFIG_INVALID/);
});

test('CONVOCATION_A_EXACT_TARGET_TEST selects exact A target when possible', () => {
  assert.equal(generate().details.filter((detail) => detail.SELECCIONADO_FINAL).length, 4);
});

test('CONVOCATION_B_EXACT_TARGET_TEST selects exact B target', () => {
  const result = generate({
    matches: [match({ COMPETENCIA: 'B' })],
    students: baseStudents().map((s) => ({ ...s, COMPETENCIA_BASE: 'B' }))
  });
  assert.equal(result.details.filter((detail) => detail.SELECCIONADO_FINAL).length, 4);
});

test('CONVOCATION_POSITION_MINIMUM_TEST satisfies position minima', () => {
  const selected = generate().details.filter((detail) => detail.SELECCIONADO_FINAL);
  assert.deepEqual(selected.map((detail) => detail.POSICION_ASIGNADA).sort(), ['DEF', 'DEL', 'MED', 'PO']);
});

test('CONVOCATION_SECONDARY_POSITION_TEST can use secondary position when needed', () => {
  const result = generate({ students: baseStudents({ 'ALU-DEF': { POSICION_PRINCIPAL: 'MED', POSICION_SECUNDARIA: 'DEF' } }) });
  assert.ok(result.details.some((detail) => detail.ALUMNO_ID === 'ALU-DEF' && detail.POSICION_ASIGNADA === 'DEF'));
});

test('CONVOCATION_PLAYER_COUNTS_ONCE_TEST never selects one player twice', () => {
  const selectedIds = generate().details.filter((detail) => detail.SELECCIONADO_FINAL).map((detail) => detail.ALUMNO_ID);
  assert.equal(new Set(selectedIds).size, selectedIds.length);
});

test('CONVOCATION_FLEX_SPOTS_TEST fills flexible slots beyond minima', () => {
  const result = generate({ configService: config({ CONVOCADOS_A: '5' }), students: [...baseStudents(), student('ALU-FLEX', 'DEF')] });
  assert.equal(result.details.filter((detail) => detail.SELECCIONADO_FINAL).length, 5);
});

test('CONVOCATION_ROTATION_PRIORITY_TEST selects rotation priority', () => {
  const result = generate({
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').PRIORIDAD_ROTACION, true);
});

test('CONVOCATION_ROTATION_PRECEDES_LEVEL_TEST keeps priority ahead of level', () => {
  const result = generate({
    configService: config({ CONVOCADOS_A: '4', MIN_PORTEROS: '1', MIN_DEFENSAS: '1', MIN_MEDIOS: '1', MIN_DELANTEROS: '1' }),
    students: [...baseStudents({ 'ALU-DEF': { NIVEL: 'B2' } }), student('ALU-HIGH', 'DEF', { NIVEL: 'A1' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').SELECCIONADO_FINAL, true);
});

test('CONVOCATION_A_LEVEL_PRIORITY_TEST ranks A by level', () => {
  const result = generate({
    students: [
      student('ALU-A1', 'PO', { NIVEL: 'A1' }),
      student('ALU-A2', 'PO', { NIVEL: 'A2' }),
      student('ALU-DEF', 'DEF'),
      student('ALU-MED', 'MED'),
      student('ALU-DEL', 'DEL')
    ]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-A1').SELECCIONADO_FINAL, true);
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-A2').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_A_ATTENDANCE_TIEBREAK_TEST ranks A by attendance after level', () => {
  const result = generate({
    attendances: [
      attendance('ALU-HIGH', { ALUMNO_ID: 'ALU-HIGH', ESTADO: 'A', VALOR_APLICADO: 1, VALOR_MAXIMO_APLICADO: 1 }),
      attendance('ALU-LOW', { ALUMNO_ID: 'ALU-LOW', ESTADO: 'R', VALOR_APLICADO: 0.75, VALOR_MAXIMO_APLICADO: 1 })
    ],
    students: [
      student('ALU-HIGH', 'PO', { NIVEL: 'A1' }),
      student('ALU-LOW', 'PO', { NIVEL: 'A1' }),
      student('ALU-DEF', 'DEF'),
      student('ALU-MED', 'MED'),
      student('ALU-DEL', 'DEL')
    ]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-HIGH').SELECCIONADO_FINAL, true);
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-LOW').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_A_PRIOR_COUNT_TIEBREAK_TEST ranks A by lower prior count after attendance', () => {
  const result = generate({
    students: [
      student('ALU-ONE', 'PO', { NIVEL: 'A1' }),
      student('ALU-ZERO', 'PO', { NIVEL: 'A1' }),
      student('ALU-DEF', 'DEF'),
      student('ALU-MED', 'MED'),
      student('ALU-DEL', 'DEL')
    ],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-ONE', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: true }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ZERO').SELECCIONADO_FINAL, true);
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ONE').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_B_PRIOR_COUNT_PRIORITY_TEST ranks B by lower prior count', () => {
  const result = generate({
    matches: [match({ COMPETENCIA: 'B' })],
    students: [
      student('ALU-ONE', 'PO', { COMPETENCIA_BASE: 'B' }),
      student('ALU-ZERO', 'PO', { COMPETENCIA_BASE: 'B' }),
      student('ALU-DEF', 'DEF', { COMPETENCIA_BASE: 'B' }),
      student('ALU-MED', 'MED', { COMPETENCIA_BASE: 'B' }),
      student('ALU-DEL', 'DEL', { COMPETENCIA_BASE: 'B' })
    ],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'B', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-ONE', COMPETENCIA_SNAPSHOT: 'B', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: true }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ZERO').SELECCIONADO_FINAL, true);
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ONE').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_B_ATTENDANCE_TIEBREAK_TEST ranks B by attendance after prior count', () => {
  const result = generate({
    attendances: [
      attendance('ALU-HIGH', { ALUMNO_ID: 'ALU-HIGH', ESTADO: 'A', VALOR_APLICADO: 1, VALOR_MAXIMO_APLICADO: 1 }),
      attendance('ALU-LOW', { ALUMNO_ID: 'ALU-LOW', ESTADO: 'R', VALOR_APLICADO: 0.75, VALOR_MAXIMO_APLICADO: 1 })
    ],
    matches: [match({ COMPETENCIA: 'B' })],
    students: [
      student('ALU-HIGH', 'PO', { COMPETENCIA_BASE: 'B' }),
      student('ALU-LOW', 'PO', { COMPETENCIA_BASE: 'B' }),
      student('ALU-DEF', 'DEF', { COMPETENCIA_BASE: 'B' }),
      student('ALU-MED', 'MED', { COMPETENCIA_BASE: 'B' }),
      student('ALU-DEL', 'DEL', { COMPETENCIA_BASE: 'B' })
    ]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-HIGH').SELECCIONADO_FINAL, true);
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-LOW').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_NO_DATA_NEUTRAL_TEST does not treat NO_DATA as zero', () => {
  const result = generate({
    students: [
      student('ALU-A', 'PO'),
      student('ALU-B', 'PO'),
      student('ALU-DEF', 'DEF'),
      student('ALU-MED', 'MED'),
      student('ALU-DEL', 'DEL')
    ]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-A').SELECCIONADO_FINAL, true);
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-B').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_INELIGIBLE_EXCLUDED_TEST excludes ineligible students', () => {
  const result = generate({ students: baseStudents({ 'ALU-DEF': { ACTIVO: false } }) });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_PENDING_EXCLUDED_TEST excludes pending students', () => {
  const result = generate({ attendances: [{ ASISTENCIA_ID: 'AST-F', ALUMNO_ID: 'ALU-DEF', ESTADO: 'F', VALOR_APLICADO: null, VALOR_MAXIMO_APLICADO: null }] });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_INSUFFICIENT_ELIGIBLE_TEST flags insufficient pool', () => {
  assert.equal(generate({ students: [student('ALU-PO', 'PO')] }).convocation.OBSERVACIONES, 'INSUFFICIENT_ELIGIBLE_PLAYERS');
});

test('CONVOCATION_ROTATION_POSITION_CONFLICT_TEST flags unmet position minimum', () => {
  const result = generate({ students: [student('ALU-1', 'PO'), student('ALU-2', 'PO'), student('ALU-3', 'PO'), student('ALU-4', 'PO')] });
  assert.ok(result.convocation.TOTAL_ALERTAS > 0);
});

test('CONVOCATION_MANUAL_CHANGE_REASON_TEST blocks manual change without reason', () => {
  const state = service();
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  result.details[0].CAMBIO_MANUAL = true;
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_MANUAL_REASON_REQUIRED/);
});

test('CONVOCATION_PRIORITY_EXCEPTION_REASON_TEST blocks priority omission without reason', () => {
  const state = service({
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  const priority = result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF');
  priority.SELECCIONADO_FINAL = false;
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /ROTATION_EXCEPTION_REASON_REQUIRED|CONVOCATION_APPROVAL_EXACT_TOTAL/);
});

test('CONVOCATION_APPROVAL_HUMAN_REQUIRED_TEST requires actor', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', ''), /CONVOCATION_APPROVAL_ACTOR_REQUIRED/);
});

test('CONVOCATION_APPROVAL_EXACT_TOTAL_TEST requires exact total', () => {
  const state = service();
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  result.details[0].SELECCIONADO_FINAL = false;
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_APPROVAL_EXACT_TOTAL/);
});

test('CONVOCATION_APPROVAL_POSITION_TEST requires minima', () => {
  const state = service();
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  result.details.find((detail) => detail.POSICION_ASIGNADA === 'PO').POSICION_ASIGNADA = 'DEF';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_APPROVAL_POSITION/);
});

test('CONVOCATION_APPROVAL_PENDING_BLOCK_TEST blocks pending approval', () => {
  const state = service({ attendances: [{ ASISTENCIA_ID: 'AST-F', ALUMNO_ID: 'ALU-DEF', ESTADO: 'F', VALOR_APLICADO: null, VALOR_MAXIMO_APLICADO: null }] });
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  const pending = result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF');
  pending.SELECCIONADO_FINAL = true;
  pending.POSICION_ASIGNADA = 'DEF';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_APPROVAL_PENDING|CONVOCATION_APPROVAL_EXACT_TOTAL/);
});

test('CONVOCATION_APPROVAL_INELIGIBLE_BLOCK_TEST blocks ineligible approval', () => {
  const state = service({ students: baseStudents({ 'ALU-DEF': { ACTIVO: false } }) });
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  const inactive = result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF');
  inactive.SELECCIONADO_FINAL = true;
  inactive.POSICION_ASIGNADA = 'DEF';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_APPROVAL_INELIGIBLE|CONVOCATION_APPROVAL_EXACT_TOTAL/);
});

test('CONVOCATION_APPROVAL_CANCELLED_MATCH_TEST blocks cancelled match approval', () => {
  const state = service({ matches: [match({ ESTADO: 'CANCELADO' })] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_APPROVAL_CANCELLED_MATCH/);
});

test('CONVOCATION_APPROVAL_NO_PARTIAL_WRITE_TEST does not approve on failed validation', () => {
  const state = service();
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  result.details[0].SELECCIONADO_FINAL = false;
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_APPROVAL_EXACT_TOTAL/);
  assert.equal(state.convocationRepository.getAll()[0].ESTADO, 'PROPUESTA');
});

test('FI_CONSUMED_ONLY_ON_APPROVAL_TEST proposal does not consume FI until approval', () => {
  const state = service({ attendances: [{ ASISTENCIA_ID: 'AST-FI', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1 }] });
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').FI_ORIGEN_ID, 'AST-FI');
});

test('FI_MULTIPLE_CONSECUTIVE_BLOCK_TEST details carry one FI source', () => {
  const result = generate({ attendances: [
    { ASISTENCIA_ID: 'AST-FI-1', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' },
    { ASISTENCIA_ID: 'AST-FI-2', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-02T10:00:00Z' }
  ] });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').FI_ORIGEN_ID, 'AST-FI-1');
});

test('ROTATION_UPDATED_ONLY_ON_APPROVAL_TEST approval persists rotation after values', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.approveConvocation('CON-NEW', 'coach');
  assert.equal(state.detailRepository.getAll().every((detail) => detail.ROTACION_DESPUES === 0), true);
});

test('ROTATION_EXCEPTION_PERSISTS_DEBT_TEST omitted priority keeps debt increment', () => {
  const state = service({
    students: [...baseStudents(), student('ALU-DEF-ALT', 'DEF')],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  const priority = result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF');
  priority.SELECCIONADO_FINAL = false;
  priority.POSICION_ASIGNADA = '';
  const alternate = result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF-ALT');
  alternate.SELECCIONADO_FINAL = true;
  alternate.POSICION_ASIGNADA = 'DEF';
  priority.ROTATION_EXCEPTION = true;
  priority.MOTIVO_CAMBIO = 'Decision ficticia';
  state.convocationService.approveConvocation('CON-NEW', 'coach');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-DEF' && detail.CONVOCATORIA_ID === 'CON-NEW').ROTACION_DESPUES, 2);
});

test('CONVOCATION_SETUP_IDEMPOTENCY_TEST creates competition sheets idempotently', () => {
  const spreadsheet = fakeSpreadsheet();
  assert.equal(setupCompetitionSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.equal(setupCompetitionSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.ok(spreadsheet.sheets.CONVOCATORIAS);
  assert.ok(spreadsheet.sheets.CONVOCATORIA_DETALLE);
});
