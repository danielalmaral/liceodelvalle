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

function clone(record) {
  return { ...record };
}

function createCopyRepository(rows) {
  return {
    rows,
    getAll() {
      return rows.map(clone);
    },
    insert(record) {
      rows.push(clone(record));
      return clone(record);
    },
    updateById(idField, id, nextRecord) {
      const index = rows.findIndex((record) => record[idField] === id);
      if (index === -1) throw new Error(`REPOSITORY_RECORD_NOT_FOUND: ${id}`);
      rows[index] = clone(nextRecord);
      return clone(nextRecord);
    }
  };
}

function repository(rows, copyOnRead) {
  return copyOnRead ? createCopyRepository(rows) : createArrayRepository(rows);
}

function service({ students = baseStudents(), matches = [match()], attendances = [], convocations = [], details = [], configService = config(), idGenerator, copyOnRead = false } = {}) {
  const convocationRepository = repository(convocations, copyOnRead);
  const detailRepository = repository(details, copyOnRead);
  const attendanceRepository = repository(attendances, copyOnRead);
  const matchRepository = repository(matches, copyOnRead);
  const studentRepository = repository(students, copyOnRead);
  const matchService = createMatchService({ matchRepository, utils });
  const metricsService = createAttendanceMetricsService({ attendanceRepository, configService, utils });
  const eligibilityService = createEligibilityService({
    attendanceRepository,
    clock: { now: () => new Date('2026-02-01T08:00:00Z') },
    convocationRepository,
    detailRepository,
    matchService,
    metricsService,
    studentRepository,
    utils
  });
  const rotationService = createRotationService({ configService, convocationRepository, detailRepository, matchService, utils });
  const convocationService = createConvocationService({
    clock: { now: () => new Date('2026-02-01T08:00:00Z') },
    configService,
    convocationRepository,
    detailRepository,
    eligibilityService,
    idGenerator: idGenerator || { convocationId: () => 'CON-NEW', detailId: (id) => `DET-${id}` },
    matchService,
    rotationService,
    studentRepository,
    utils
  });

  return { attendanceRepository, convocationRepository, convocationService, detailRepository, matchRepository, studentRepository };
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
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').PRIORIDAD_ROTACION, true);
});

test('CONVOCATION_ROTATION_PRECEDES_LEVEL_TEST keeps priority ahead of level', () => {
  const result = generate({
    configService: config({ CONVOCADOS_A: '4', MIN_PORTEROS: '1', MIN_DEFENSAS: '1', MIN_MEDIOS: '1', MIN_DELANTEROS: '1' }),
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    students: [...baseStudents({ 'ALU-DEF': { NIVEL: 'B2' } }), student('ALU-HIGH', 'DEF', { NIVEL: 'A1' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
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
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    students: [
      student('ALU-ONE', 'PO', { NIVEL: 'A1' }),
      student('ALU-ZERO', 'PO', { NIVEL: 'A1' }),
      student('ALU-DEF', 'DEF'),
      student('ALU-MED', 'MED'),
      student('ALU-DEL', 'DEL')
    ],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-ONE', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: true }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ZERO').SELECCIONADO_FINAL, true);
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ONE').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_B_PRIOR_COUNT_PRIORITY_TEST ranks B by lower prior count', () => {
  const result = generate({
    matches: [match({ COMPETENCIA: 'B' }), match({ PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'B', FECHA: '2026-01-01' })],
    students: [
      student('ALU-ONE', 'PO', { COMPETENCIA_BASE: 'B' }),
      student('ALU-ZERO', 'PO', { COMPETENCIA_BASE: 'B' }),
      student('ALU-DEF', 'DEF', { COMPETENCIA_BASE: 'B' }),
      student('ALU-MED', 'MED', { COMPETENCIA_BASE: 'B' }),
      student('ALU-DEL', 'DEL', { COMPETENCIA_BASE: 'B' })
    ],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'B', ESTADO: 'APROBADA' }],
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
  assert.match(generate({ students: [student('ALU-PO', 'PO')] }).convocation.OBSERVACIONES, /INSUFFICIENT_ELIGIBLE_PLAYERS/);
});

test('CONVOCATION_ROTATION_POSITION_CONFLICT_TEST flags unmet position minimum', () => {
  const result = generate({ students: [student('ALU-1', 'PO'), student('ALU-2', 'PO'), student('ALU-3', 'PO'), student('ALU-4', 'PO')] });
  assert.ok(result.convocation.TOTAL_ALERTAS > 0);
});

test('CONVOCATION_MANUAL_CHANGE_REASON_TEST blocks manual change without reason', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', false, ''), /CONVOCATION_MANUAL_REASON_REQUIRED/);
});

test('CONVOCATION_PRIORITY_EXCEPTION_REASON_TEST blocks priority omission without reason', () => {
  const state = service({
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-DEF', false, ''), /ROTATION_EXCEPTION_REASON_REQUIRED|CONVOCATION_MANUAL_REASON_REQUIRED/);
});

test('CONVOCATION_APPROVAL_HUMAN_REQUIRED_TEST requires actor', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', ''), /CONVOCATION_APPROVAL_ACTOR_REQUIRED/);
});

test('CONVOCATION_APPROVAL_EXACT_TOTAL_TEST requires exact total', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', false, 'Decision ficticia');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_APPROVAL_EXACT_TOTAL/);
});

test('CONVOCATION_APPROVAL_POSITION_TEST requires minima', () => {
  const state = service({ students: baseStudents({ 'ALU-PO': { POSICION_SECUNDARIA: 'DEF' } }) });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.assignPlayerPosition('CON-NEW', 'ALU-PO', 'DEF', 'Decision ficticia');
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
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', false, 'Decision ficticia');
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
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    students: [...baseStudents(), student('ALU-DEF-ALT', 'DEF')],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-DEF', false, 'Decision ficticia');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-DEF-ALT', true, 'Decision ficticia');
  state.convocationService.assignPlayerPosition('CON-NEW', 'ALU-DEF-ALT', 'DEF', 'Decision ficticia');
  state.convocationService.approveConvocation('CON-NEW', 'coach');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-DEF' && detail.CONVOCATORIA_ID === 'CON-NEW').ROTACION_DESPUES, 2);
});

test('CONVOCATION_APPROVAL_STATE_TRANSITION_TEST rejects non proposal approval', () => {
  const state = service({ convocations: [{ ...generate().convocation, ESTADO: 'BORRADOR' }] });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_INVALID_STATE_TRANSITION/);
});

test('CONVOCATION_DOUBLE_APPROVAL_REJECTED_TEST rejects repeated approval', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.approveConvocation('CON-NEW', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_INVALID_STATE_TRANSITION/);
});

test('CONVOCATION_STALE_INJURY_TEST rejects changed injury status', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.find((row) => row.ALUMNO_ID === 'ALU-DEF').ESTADO_DEPORTIVO = 'LESIONADO';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_SUSPENSION_TEST rejects changed suspension status', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.find((row) => row.ALUMNO_ID === 'ALU-DEF').ESTADO_DEPORTIVO = 'SUSPENDIDO';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_PENDING_ABSENCE_TEST rejects new pending absence', () => {
  const attendances = [];
  const state = service({ attendances });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  attendances.push({ ASISTENCIA_ID: 'AST-F', ALUMNO_ID: 'ALU-DEF', ESTADO: 'F', VALOR_APLICADO: null, VALOR_MAXIMO_APLICADO: null });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_FI_TEST rejects new FI', () => {
  const attendances = [];
  const state = service({ attendances });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  attendances.push({ ASISTENCIA_ID: 'AST-FI', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_FI_CONSUMPTION_TEST rejects consumed FI before approval', () => {
  const attendances = [{ ASISTENCIA_ID: 'AST-FI', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' }];
  const matches = [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })];
  const convocations = [];
  const details = [];
  const state = service({ attendances, matches, convocations, details });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  convocations.push({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' });
  details.push({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'FI_BLOCK', FI_ORIGEN_ID: 'AST-FI', COMPETENCIA_SNAPSHOT: 'A', SELECCIONADO_FINAL: false });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_ROTATION_TEST rejects changed rotation debt', () => {
  const matches = [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })];
  const convocations = [];
  const details = [];
  const state = service({ matches, convocations, details });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  convocations.push({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' });
  details.push({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', ELEGIBILITY_STATUS: 'ELIGIBLE', COMPETENCIA_SNAPSHOT: 'A', SELECCIONADO_FINAL: false });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_NO_PARTIAL_WRITE_TEST preserves proposal on stale failure', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students[0].ACTIVO = false;
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
  assert.equal(state.convocationRepository.getAll()[0].ESTADO, 'PROPUESTA');
});

test('FI_CANNOT_BE_CONSUMED_TWICE_TEST rejects prior FI consumption', () => {
  const attendances = [{ ASISTENCIA_ID: 'AST-FI', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' }];
  const matches = [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })];
  const state = service({
    attendances,
    matches,
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'FI_BLOCK', FI_ORIGEN_ID: 'AST-FI', COMPETENCIA_SNAPSHOT: 'A', SELECCIONADO_FINAL: false }]
  });
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').FI_ORIGEN_ID, '');
});

test('FI_TWO_STALE_PROPOSALS_TEST keeps duplicate proposals stale-safe', () => {
  const attendances = [{ ASISTENCIA_ID: 'AST-FI', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' }];
  const matches = [match(), match({ PARTIDO_ID: 'PAR-002', FECHA: '2026-02-02' })];
  const convocations = [];
  const details = [];
  const state = service({ attendances, matches, convocations, details, students: [...baseStudents(), student('ALU-FLEX', 'DEF')], idGenerator: { convocationId: () => `CON-${convocations.length + 1}`, detailId: (id) => `DET-${convocations.length + 1}-${id}` } });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.generateConvocation('PAR-002', 'coach');
  assert.equal(details.filter((detail) => detail.FI_ORIGEN_ID === 'AST-FI').length, 2);
});

test('FI_SECOND_APPROVAL_REJECTED_TEST rejects second stale FI approval', () => {
  const attendances = [{ ASISTENCIA_ID: 'AST-FI', ALUMNO_ID: 'ALU-DEF', ESTADO: 'FI', VALOR_APLICADO: 0, VALOR_MAXIMO_APLICADO: 1, REGISTRADO_EN: '2026-01-01T10:00:00Z' }];
  const matches = [match(), match({ PARTIDO_ID: 'PAR-002', FECHA: '2026-02-02' })];
  const convocations = [];
  const details = [];
  const state = service({ attendances, matches, convocations, details, students: [...baseStudents(), student('ALU-FLEX', 'DEF')], idGenerator: { convocationId: () => `CON-${convocations.length + 1}`, detailId: (id) => `DET-${convocations.length + 1}-${id}` } });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.generateConvocation('PAR-002', 'coach');
  state.convocationService.approveConvocation('CON-1', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-2', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_SINGLE_APPROVED_PER_MATCH_TEST rejects second approved same match', () => {
  const state = service({
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA' }]
  });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_MATCH_ALREADY_APPROVED/);
});

test('CONVOCATION_MULTIPLE_PROPOSALS_ALLOWED_TEST allows multiple proposals for same match', () => {
  const convocations = [];
  const state = service({ convocations, idGenerator: { convocationId: () => `CON-${convocations.length + 1}`, detailId: (id) => `DET-${convocations.length + 1}-${id}` } });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.equal(convocations.length, 2);
});

test('CONVOCATION_MANUAL_SELECT_PERSISTENCE_TEST persists explicit selection', () => {
  const state = service({ configService: config({ CONVOCADOS_A: '5' }), students: [...baseStudents(), student('ALU-FLEX', 'DEF')] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-FLEX', false, 'Decision ficticia');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-FLEX', true, '');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-FLEX').SELECCIONADO_FINAL, true);
});

test('CONVOCATION_MANUAL_DESELECT_PERSISTENCE_TEST persists explicit removal', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', false, 'Decision ficticia');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-PO').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_MANUAL_POSITION_PERSISTENCE_TEST persists explicit position assignment', () => {
  const state = service({ students: baseStudents({ 'ALU-PO': { POSICION_SECUNDARIA: 'DEF' } }) });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.assignPlayerPosition('CON-NEW', 'ALU-PO', 'DEF', 'Decision ficticia');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-PO').POSICION_ASIGNADA, 'DEF');
});

test('CONVOCATION_MANUAL_CHANGE_COPY_ON_READ_TEST does not rely on returned object mutation', () => {
  const state = service({ copyOnRead: true });
  const result = state.convocationService.generateConvocation('PAR-001', 'coach');
  result.details[0].SELECCIONADO_FINAL = false;
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === result.details[0].ALUMNO_ID).SELECCIONADO_FINAL, true);
});

test('CONVOCATION_MANUAL_CHANGE_REASON_REQUIRED_TEST requires reason for manual selection delta', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', false, ''), /CONVOCATION_MANUAL_REASON_REQUIRED/);
});

test('CONVOCATION_MANUAL_INELIGIBLE_REJECTED_TEST rejects ineligible manual selection', () => {
  const state = service({ students: baseStudents({ 'ALU-DEF': { ACTIVO: false } }) });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-DEF', true, 'Decision ficticia'), /CONVOCATION_MANUAL_INELIGIBLE/);
});

test('CONVOCATION_MANUAL_PENDING_REJECTED_TEST rejects pending manual selection', () => {
  const state = service({ attendances: [{ ASISTENCIA_ID: 'AST-F', ALUMNO_ID: 'ALU-DEF', ESTADO: 'F', VALOR_APLICADO: null, VALOR_MAXIMO_APLICADO: null }] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-DEF', true, 'Decision ficticia'), /CONVOCATION_MANUAL_PENDING/);
});

test('CONVOCATION_MANUAL_PRIORITY_EXCEPTION_TEST marks priority exception', () => {
  const state = service({
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-DEF', false, 'Decision ficticia');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.CONVOCATORIA_ID === 'CON-NEW' && detail.ALUMNO_ID === 'ALU-DEF').ROTATION_EXCEPTION, true);
});

test('CONVOCATION_MANUAL_ONLY_PROPOSAL_TEST rejects edits outside proposal', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.approveConvocation('CON-NEW', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', false, 'Decision ficticia'), /CONVOCATION_INVALID_STATE_TRANSITION/);
});

test('CONVOCATION_DETAIL_ID_UNIQUENESS_TEST rejects duplicate detail ids', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.detailRepository.insert({ ...state.detailRepository.getAll()[0], ALUMNO_ID: 'ALU-X' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_DUPLICATE_ID/);
});

test('CONVOCATION_DETAIL_STUDENT_UNIQUENESS_TEST rejects duplicate students', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.detailRepository.insert({ ...state.detailRepository.getAll()[0], DETALLE_ID: 'DET-X' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_DUPLICATE_STUDENT/);
});

test('CONVOCATION_DETAIL_FOREIGN_KEY_TEST rejects wrong detail convocation id', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll()[0];
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, CONVOCATORIA_ID: 'CON-X' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_SET_MISMATCH/);
});

test('CONVOCATION_DETAIL_COMPETITION_TEST rejects wrong competition snapshot', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll()[0];
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, COMPETENCIA_SNAPSHOT: 'B' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_COMPETITION/);
});

test('CONVOCATION_ASSIGNED_POSITION_ENUM_TEST rejects invalid selected position enum', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll()[0];
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, POSICION_ASIGNADA: 'GK' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_ASSIGNED_POSITION_ENUM/);
});

test('CONVOCATION_ASSIGNED_POSITION_ALLOWED_TEST rejects position outside player positions', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll()[0];
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, POSICION_ASIGNADA: 'DEF' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_ASSIGNED_POSITION_INVALID/);
});

test('CONVOCATION_DUPLICATE_PLAYER_APPROVAL_TEST rejects one player counted twice', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.detailRepository.insert({ ...state.detailRepository.getAll()[0], DETALLE_ID: 'DET-X' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_DUPLICATE_STUDENT/);
});

test('CONVOCATION_GENERATED_IDS_UNIQUE_TEST rejects duplicate generated detail ids', () => {
  assert.throws(() => generate({ idGenerator: { convocationId: () => 'CON-X', detailId: () => 'DET-DUP' } }), /CONVOCATION_DETAIL_DUPLICATE_ID/);
});

test('CONVOCATION_CURRENT_POOL_SET_TEST approves only when detail set matches current pool', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.equal(state.convocationService.approveConvocation('CON-NEW', 'coach').ESTADO, 'APROBADA');
});

test('CONVOCATION_NEW_POOL_STUDENT_STALE_TEST rejects new current pool student', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.push(student('ALU-NEW', 'DEF'));
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_SET_MISMATCH/);
});

test('CONVOCATION_MISSING_UNSELECTED_DETAIL_TEST rejects missing detail', () => {
  const state = service({ configService: config({ CONVOCADOS_A: '5' }), students: [...baseStudents(), student('ALU-FLEX', 'DEF')] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.detailRepository.setRows(state.detailRepository.getAll().filter((detail) => detail.ALUMNO_ID !== 'ALU-FLEX'));
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_SET_MISMATCH/);
});

test('CONVOCATION_EXTRA_DETAIL_STALE_TEST rejects detail outside current pool', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.detailRepository.insert({ ...state.detailRepository.getAll()[0], DETALLE_ID: 'DET-EXTRA', ALUMNO_ID: 'ALU-EXTRA' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_SET_MISMATCH|CONVOCATION_DETAIL_DUPLICATE/);
});

test('CONVOCATION_POOL_CHANGE_NO_PARTIAL_WRITE_TEST preserves proposal on pool change', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.push(student('ALU-NEW', 'DEF'));
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_SET_MISMATCH/);
  assert.equal(state.convocationRepository.getAll()[0].ESTADO, 'PROPUESTA');
});

test('CONVOCATION_STALE_LEVEL_TEST rejects current level change', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.find((row) => row.ALUMNO_ID === 'ALU-DEF').NIVEL = 'A2';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_PRIMARY_POSITION_TEST rejects current primary position change', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.find((row) => row.ALUMNO_ID === 'ALU-DEF').POSICION_PRINCIPAL = 'MED';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_SECONDARY_POSITION_TEST rejects current secondary position change', () => {
  const students = baseStudents({ 'ALU-DEF': { POSICION_SECUNDARIA: 'MED' } });
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.find((row) => row.ALUMNO_ID === 'ALU-DEF').POSICION_SECUNDARIA = 'DEL';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_ATTENDANCE_SCORE_TEST rejects changed compliance score', () => {
  const attendances = [];
  const state = service({ attendances });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  attendances.push(attendance('ALU-DEF', { ALUMNO_ID: 'ALU-DEF' }));
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_PHYSICAL_PRESENCE_TEST rejects changed physical presence', () => {
  const attendances = [attendance('ALU-DEF-A', { ALUMNO_ID: 'ALU-DEF', ESTADO: 'A', VALOR_APLICADO: 1, VALOR_MAXIMO_APLICADO: 1 })];
  const state = service({ attendances });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  attendances.push(attendance('ALU-DEF-FJ', { ALUMNO_ID: 'ALU-DEF', ESTADO: 'FJ', VALOR_APLICADO: 1, VALOR_MAXIMO_APLICADO: 1 }));
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_STALE_PRIOR_SELECTION_COUNT_TEST rejects changed previous count', () => {
  const matches = [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })];
  const convocations = [];
  const details = [];
  const state = service({ matches, convocations, details });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  convocations.push({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' });
  details.push({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: true });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_FULL_RANKING_FRESHNESS_TEST rejects any ranking input drift', () => {
  const students = baseStudents();
  const state = service({ students });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  students.find((row) => row.ALUMNO_ID === 'ALU-MED').NIVEL = 'A2';
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_STALE_PROPOSAL/);
});

test('CONVOCATION_MANUAL_SELECTION_BOOLEAN_TEST accepts explicit boolean strings', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', 'NO', 'Decision ficticia');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-PO').SELECCIONADO_FINAL, false);
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', 'SI', '');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-PO').SELECCIONADO_FINAL, true);
});

test('CONVOCATION_MANUAL_FALSE_STRING_TEST treats FALSE as false', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', 'false', 'Decision ficticia');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-PO').SELECCIONADO_FINAL, false);
});

test('CONVOCATION_MANUAL_INVALID_BOOLEAN_TEST rejects unsupported selection values', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', 'yes', 'Decision ficticia'), /CONVOCATION_DETAIL_BOOLEAN_INVALID/);
});

test('CONVOCATION_MANUAL_REASON_WHITESPACE_TEST rejects whitespace reason', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-PO', false, '   '), /CONVOCATION_MANUAL_REASON_REQUIRED/);
});

test('CONVOCATION_PRIORITY_REASON_WHITESPACE_TEST rejects whitespace priority exception reason', () => {
  const state = service({
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }]
  });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.setFinalSelection('CON-NEW', 'ALU-DEF', false, '   '), /CONVOCATION_MANUAL_REASON_REQUIRED|ROTATION_EXCEPTION_REASON_REQUIRED/);
});

test('CONVOCATION_APPROVAL_ACTOR_WHITESPACE_TEST rejects whitespace actor', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', '   '), /CONVOCATION_APPROVAL_ACTOR_REQUIRED/);
});

test('CONVOCATION_POSITION_NORMALIZATION_TEST normalizes assigned position', () => {
  const state = service({ students: baseStudents({ 'ALU-PO': { POSICION_SECUNDARIA: 'DEF' } }) });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.convocationService.assignPlayerPosition('CON-NEW', 'ALU-PO', ' def ', 'Decision ficticia');
  assert.equal(state.detailRepository.getAll().find((detail) => detail.ALUMNO_ID === 'ALU-PO').POSICION_ASIGNADA, 'DEF');
});

test('CONVOCATION_DETAIL_BOOLEAN_INTEGRITY_TEST rejects non canonical detail booleans', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll()[0];
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, SELECCIONADO_FINAL: 'yes' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_DETAIL_BOOLEAN_INVALID/);
});

test('CONVOCATION_DETAIL_EXISTING_ID_COLLISION_TEST rejects existing detail id collision', () => {
  assert.throws(() => generate({ details: [{ DETALLE_ID: 'DET-ALU-PO', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-X' }] }), /CONVOCATION_DETAIL_ID_COLLISION/);
});

test('CONVOCATION_GENERATION_ID_PREFLIGHT_TEST rejects duplicate convocation before inserts', () => {
  const convocations = [{ CONVOCATORIA_ID: 'CON-NEW', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'PROPUESTA' }];
  const details = [];
  const state = service({ convocations, details });
  assert.throws(() => state.convocationService.generateConvocation('PAR-001', 'coach'), /CONVOCATION_DUPLICATE_ID/);
  assert.equal(details.length, 0);
});

test('CONVOCATION_GENERATION_ID_COLLISION_NO_PARTIAL_WRITE_TEST rejects detail collision before partial writes', () => {
  const convocations = [];
  const details = [{ DETALLE_ID: 'DET-ALU-PO', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-X' }];
  const state = service({ convocations, details });
  assert.throws(() => state.convocationService.generateConvocation('PAR-001', 'coach'), /CONVOCATION_DETAIL_ID_COLLISION/);
  assert.equal(convocations.length, 0);
  assert.equal(details.length, 1);
});

test('CONVOCATION_PRIORITY_OVERFLOW_ALERT_TEST surfaces priority overflow', () => {
  const oldMatches = [match(), match({ PARTIDO_ID: 'PAR-OLD-1', FECHA: '2026-01-01' })];
  const oldConvocations = [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD-1', COMPETENCIA: 'A', ESTADO: 'APROBADA' }];
  const players = [...baseStudents(), student('ALU-FLEX', 'DEF')];
  const oldDetails = players.map((row) => ({ DETALLE_ID: `OLD-${row.ALUMNO_ID}`, CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: row.ALUMNO_ID, COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }));
  const result = generate({ matches: oldMatches, convocations: oldConvocations, details: oldDetails, students: players });
  assert.match(result.convocation.OBSERVACIONES, /ROTATION_POSITION_CONFLICT/);
});

test('CONVOCATION_MULTIPLE_ALERTS_TEST keeps multiple alert codes', () => {
  const result = generate({ students: [student('ALU-1', 'PO')] });
  assert.match(result.convocation.OBSERVACIONES, /INSUFFICIENT_ELIGIBLE_PLAYERS\|ROTATION_POSITION_CONFLICT/);
});

test('CONVOCATION_PRIORITY_OVERFLOW_APPROVAL_REASON_TEST requires reasons for omitted priorities', () => {
  const players = [...baseStudents(), student('ALU-FLEX', 'DEF')];
  const state = service({
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    students: players,
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: players.map((row) => ({ DETALLE_ID: `OLD-${row.ALUMNO_ID}`, CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: row.ALUMNO_ID, COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: false }))
  });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /ROTATION_EXCEPTION_REASON_REQUIRED|CONVOCATION_APPROVAL_EXACT_TOTAL/);
});

test('CONVOCATION_PRIORITY_ORDER_A_TEST stores A ranking order', () => {
  const result = generate({ students: [student('ALU-A2', 'PO', { NIVEL: 'A2' }), student('ALU-A1', 'PO', { NIVEL: 'A1' }), student('ALU-DEF', 'DEF'), student('ALU-MED', 'MED'), student('ALU-DEL', 'DEL')] });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-A1').ORDEN_PRIORIDAD, 1);
});

test('CONVOCATION_PRIORITY_ORDER_B_TEST stores B ranking order', () => {
  const result = generate({
    matches: [match({ COMPETENCIA: 'B' }), match({ PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'B', FECHA: '2026-01-01' })],
    students: [student('ALU-ONE', 'PO', { COMPETENCIA_BASE: 'B' }), student('ALU-ZERO', 'PO', { COMPETENCIA_BASE: 'B' }), student('ALU-DEF', 'DEF', { COMPETENCIA_BASE: 'B' }), student('ALU-MED', 'MED', { COMPETENCIA_BASE: 'B' }), student('ALU-DEL', 'DEL', { COMPETENCIA_BASE: 'B' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'B', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-ONE', COMPETENCIA_SNAPSHOT: 'B', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: true }]
  });
  assert.ok(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ZERO').ORDEN_PRIORIDAD < result.details.find((detail) => detail.ALUMNO_ID === 'ALU-ONE').ORDEN_PRIORIDAD);
});

test('CONVOCATION_PRIORITY_ORDER_REPOSITORY_INVARIANT_TEST ranking ignores repository order', () => {
  const result = generate({ students: [student('ALU-DEL', 'DEL'), student('ALU-MED', 'MED'), student('ALU-DEF', 'DEF'), student('ALU-PO', 'PO')] });
  const order = result.details.filter((detail) => detail.ELEGIBILITY_STATUS === 'ELIGIBLE').map((detail) => `${detail.ORDEN_PRIORIDAD}:${detail.ALUMNO_ID}`).sort();
  assert.deepEqual(order, ['1:ALU-DEF', '2:ALU-DEL', '3:ALU-MED', '4:ALU-PO']);
});

test('CONVOCATION_DIRECT_SELECTION_TAMPER_REJECTED_TEST rejects undeclared direct selection swap', () => {
  const state = service({ configService: config({ CONVOCADOS_A: '4' }), students: [...baseStudents(), student('ALU-FLEX', 'DEF')] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const details = state.detailRepository.getAll();
  const selected = details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF');
  const flex = details.find((detail) => detail.ALUMNO_ID === 'ALU-FLEX');
  state.detailRepository.updateById('DETALLE_ID', selected.DETALLE_ID, { ...selected, SELECCIONADO_FINAL: false, POSICION_ASIGNADA: '', CAMBIO_MANUAL: false, MOTIVO_CAMBIO: '' });
  state.detailRepository.updateById('DETALLE_ID', flex.DETALLE_ID, { ...flex, SELECCIONADO_FINAL: true, POSICION_ASIGNADA: 'DEF', CAMBIO_MANUAL: false, MOTIVO_CAMBIO: '' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_MANUAL_CHANGE_NOT_DECLARED/);
});

test('CONVOCATION_DIRECT_SELECTION_TAMPER_WITH_REASON_TEST allows declared direct selection swap', () => {
  const state = service({ configService: config({ CONVOCADOS_A: '4' }), students: [...baseStudents(), student('ALU-FLEX', 'DEF')] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const details = state.detailRepository.getAll();
  const selected = details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF');
  const flex = details.find((detail) => detail.ALUMNO_ID === 'ALU-FLEX');
  state.detailRepository.updateById('DETALLE_ID', selected.DETALLE_ID, { ...selected, SELECCIONADO_FINAL: false, POSICION_ASIGNADA: '', CAMBIO_MANUAL: true, MOTIVO_CAMBIO: 'Decision ficticia' });
  state.detailRepository.updateById('DETALLE_ID', flex.DETALLE_ID, { ...flex, SELECCIONADO_FINAL: true, POSICION_ASIGNADA: 'DEF', CAMBIO_MANUAL: true, MOTIVO_CAMBIO: 'Decision ficticia' });
  assert.equal(state.convocationService.approveConvocation('CON-NEW', 'coach').ESTADO, 'APROBADA');
});

test('CONVOCATION_RECOMMENDATION_FLAG_TAMPER_TEST rejects changed recommendation flag', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll().find((row) => row.ALUMNO_ID === 'ALU-DEF');
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, RECOMENDADO_SISTEMA: false });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_SYSTEM_RECOMMENDATION_CORRUPTED/);
});

test('CONVOCATION_PRIORITY_ORDER_TAMPER_TEST rejects changed priority order', () => {
  const state = service();
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll().find((row) => row.ALUMNO_ID === 'ALU-DEF');
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, ORDEN_PRIORIDAD: 99 });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_PRIORITY_ORDER_CORRUPTED/);
});

test('CONVOCATION_DIRECT_POSITION_TAMPER_REJECTED_TEST rejects undeclared direct position change', () => {
  const state = service({ configService: config({ CONVOCADOS_A: '5' }), students: [...baseStudents({ 'ALU-PO': { POSICION_SECUNDARIA: 'DEF' } }), student('ALU-ALT-PO', 'PO')] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll().find((row) => row.ALUMNO_ID === 'ALU-PO');
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, POSICION_ASIGNADA: 'DEF', CAMBIO_MANUAL: false, MOTIVO_CAMBIO: '' });
  assert.throws(() => state.convocationService.approveConvocation('CON-NEW', 'coach'), /CONVOCATION_MANUAL_CHANGE_NOT_DECLARED/);
});

test('CONVOCATION_DIRECT_POSITION_TAMPER_WITH_REASON_TEST allows declared direct position change', () => {
  const state = service({ configService: config({ CONVOCADOS_A: '5' }), students: [...baseStudents({ 'ALU-PO': { POSICION_SECUNDARIA: 'DEF' } }), student('ALU-ALT-PO', 'PO')] });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  const detail = state.detailRepository.getAll().find((row) => row.ALUMNO_ID === 'ALU-PO');
  state.detailRepository.updateById('DETALLE_ID', detail.DETALLE_ID, { ...detail, POSICION_ASIGNADA: 'DEF', CAMBIO_MANUAL: true, MOTIVO_CAMBIO: 'Decision ficticia' });
  assert.equal(state.convocationService.approveConvocation('CON-NEW', 'coach').ESTADO, 'APROBADA');
});

test('CONVOCATION_RECOMMENDATION_REBUILD_REPOSITORY_ORDER_TEST rebuilds recommendation independent of repository order', () => {
  const students = baseStudents();
  const details = [];
  const state = service({ students, details });
  state.convocationService.generateConvocation('PAR-001', 'coach');
  state.studentRepository.setRows(students.slice().reverse());
  state.detailRepository.setRows(details.slice().reverse());
  assert.equal(state.convocationService.approveConvocation('CON-NEW', 'coach').ESTADO, 'APROBADA');
});

test('CONVOCATION_PRIOR_COUNT_FALSE_STRING_TEST does not count FALSE selected history', () => {
  const result = generate({
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: 'FALSE' }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').TOTAL_CONVOCATORIAS_PREVIAS, 0);
});

test('CONVOCATION_PRIOR_COUNT_TRUE_STRING_TEST counts TRUE selected history', () => {
  const result = generate({
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: 'TRUE' }]
  });
  assert.equal(result.details.find((detail) => detail.ALUMNO_ID === 'ALU-DEF').TOTAL_CONVOCATORIAS_PREVIAS, 1);
});

test('CONVOCATION_PRIOR_COUNT_INVALID_BOOLEAN_TEST rejects invalid selected history', () => {
  assert.throws(() => generate({
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [{ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD', COMPETENCIA: 'A', ESTADO: 'APROBADA' }],
    details: [{ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD', ALUMNO_ID: 'ALU-DEF', COMPETENCIA_SNAPSHOT: 'A', ELEGIBILITY_STATUS: 'ELIGIBLE', SELECCIONADO_FINAL: 'yes' }]
  }), /CONVOCATION_HISTORY_BOOLEAN_INVALID/);
});

test('CONVOCATION_SETUP_IDEMPOTENCY_TEST creates competition sheets idempotently', () => {
  const spreadsheet = fakeSpreadsheet();
  assert.equal(setupCompetitionSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.equal(setupCompetitionSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.ok(spreadsheet.sheets.CONVOCATORIAS);
  assert.ok(spreadsheet.sheets.CONVOCATORIA_DETALLE);
});
