const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { setupSheetWithHeaders } = require('../../src/common/SheetSetup');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
const { createConfigService } = require('../../src/config/ConfigService');
require('../../src/domain/AttendanceContracts');
require('../../src/domain/AttendanceConfigPolicy');
require('../../src/domain/AttendanceSnapshotValidator');
const { setupAttendanceSheets } = require('../../src/config/AttendanceSetup');
const { createAttendanceFoundationService } = require('../../src/services/AttendanceFoundationService');
const { completeConfigRows } = require('../config/config-fixtures');
const { setupMasterDataSheets } = require('../../src/config/MasterDataSetup');
require('../../src/domain/MasterDataContracts');

function session(overrides = {}) {
  return {
    SESION_ID: 'SES-001',
    TIPO: 'ENTRENAMIENTO',
    FECHA: '2026-01-02',
    HORA_INICIO: '10:00',
    HORA_FIN: '11:00',
    COMPETENCIA: 'GENERAL',
    PARTIDO_ID: '',
    DESCRIPCION: '',
    ESTADO: 'ABIERTA',
    CREADA_EN: '',
    CERRADA_EN: '',
    ...overrides
  };
}

function student(overrides = {}) {
  return { ALUMNO_ID: 'ALU-001', ...overrides };
}

function attendance(overrides = {}) {
  return {
    ASISTENCIA_ID: 'AST-001',
    SESION_ID: 'SES-001',
    ALUMNO_ID: 'ALU-001',
    ESTADO: 'A',
    VALOR_APLICADO: 1,
    VALOR_MAXIMO_APLICADO: 1,
    REGISTRADO_EN: '2026-01-02T10:00:00Z',
    LIMITE_JUSTIFICACION: '',
    MODIFICADO_EN: '',
    JUSTIFICACION: '',
    AVISO_ENVIADO: false,
    COMUNICACION_ID: '',
    OBSERVACIONES: '',
    ...overrides
  };
}

function config(overrides = {}) {
  return createConfigService(createConfigRepository(completeConfigRows(overrides)));
}

function service({ sessions = [session()], students = [student()], attendances = [], configService = config() } = {}) {
  return createAttendanceFoundationService({
    attendanceRepository: createArrayRepository(attendances),
    clock: { now: () => new Date('2026-01-02T10:00:00Z') },
    configService,
    idGenerator: { attendanceId: () => 'AST-NEW' },
    sessionRepository: createArrayRepository(sessions),
    studentRepository: createArrayRepository(students),
    utils
  });
}

function repositoryRows(serviceRows) {
  return serviceRows;
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

test('SESSION_SCHEMA_TEST validates session fields', () => {
  assert.equal(service().getSessions()[0].sesionId, 'SES-001');
});

test('SESSION_ID_UNIQUENESS_TEST rejects duplicate sessions', () => {
  assert.throws(() => service({ sessions: [session(), session({ FECHA: '2026-01-03' })] }).getSessions(), /SESSION_DUPLICATE_ID/);
});

test('SESSION_ENUMS_TEST validates session enums', () => {
  assert.throws(() => service({ sessions: [session({ TIPO: 'CLASE' })] }).getSessions(), /INVALID_ENUM: TIPO/);
});

test('SESSION_TIME_RANGE_TEST rejects inverted times', () => {
  assert.throws(() => service({ sessions: [session({ HORA_FIN: '09:59' })] }).getSessions(), /SESSION_TIME_RANGE/);
});

test('ATTENDANCE_SCHEMA_TEST validates attendance fields', () => {
  assert.equal(service({ attendances: [attendance()] }).getAttendances()[0].estado, 'A');
});

test('ATTENDANCE_ID_UNIQUENESS_TEST rejects duplicate ids', () => {
  assert.throws(() => service({ attendances: [attendance(), attendance({ ALUMNO_ID: 'ALU-002' })], students: [student(), student({ ALUMNO_ID: 'ALU-002' })] }).getAttendances(), /ATTENDANCE_DUPLICATE_ID/);
});

test('ATTENDANCE_SESSION_FK_TEST requires existing session', () => {
  assert.throws(() => service({ attendances: [attendance({ SESION_ID: 'SES-404' })] }).getAttendances(), /ATTENDANCE_SESSION_FK/);
});

test('ATTENDANCE_STUDENT_FK_TEST requires existing student', () => {
  assert.throws(() => service({ attendances: [attendance({ ALUMNO_ID: 'ALU-404' })] }).getAttendances(), /ATTENDANCE_STUDENT_FK/);
});

test('ATTENDANCE_COMPOSITE_UNIQUENESS_TEST rejects duplicate session student pair', () => {
  assert.throws(() => service({ attendances: [attendance(), attendance({ ASISTENCIA_ID: 'AST-002' })] }).getAttendances(), /ATTENDANCE_DUPLICATE_SESSION_STUDENT/);
});

test('ATTENDANCE_INITIAL_STATUS_TEST only accepts A R F for capture', () => {
  assert.throws(() => service().createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'FI' }), /INVALID_ENUM: ESTADO/);
});

test('ATTENDANCE_CONFIG_SNAPSHOT_TEST snapshots A and R from CONFIG', () => {
  assert.deepEqual(service().createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' }).VALOR_APLICADO, 1);
  assert.equal(service().createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'R' }).VALOR_APLICADO, 0.75);
});

test('ATTENDANCE_CREATE_STUDENT_FK_TEST rejects create for missing student before write', () => {
  const rows = [];
  assert.throws(() => service({ attendances: rows }).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-404', estado: 'A' }), /ATTENDANCE_STUDENT_FK/);
  assert.equal(rows.length, 0);
});

test('ATTENDANCE_CREATE_DUPLICATE_PAIR_TEST rejects duplicate SESION_ID ALUMNO_ID before write', () => {
  const rows = [attendance()];
  assert.throws(() => service({ attendances: rows }).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A', asistenciaId: 'AST-002' }), /ATTENDANCE_DUPLICATE_SESSION_STUDENT/);
  assert.equal(rows.length, 1);
});

test('ATTENDANCE_CREATE_ID_REQUIRED_TEST rejects missing generated id before write', () => {
  const svc = createAttendanceFoundationService({
    attendanceRepository: createArrayRepository([]),
    clock: { now: () => new Date('2026-01-02T10:00:00Z') },
    configService: config(),
    idGenerator: {},
    sessionRepository: createArrayRepository([session()]),
    studentRepository: createArrayRepository([student()]),
    utils
  });

  assert.throws(() => svc.createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' }), /ATTENDANCE_ID_REQUIRED/);
});

test('ATTENDANCE_CREATE_ID_UNIQUENESS_TEST rejects duplicate ASISTENCIA_ID before write', () => {
  const rows = [attendance()];
  assert.throws(() => service({ attendances: rows, students: [student(), student({ ALUMNO_ID: 'ALU-002' })] }).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-002', estado: 'A', asistenciaId: 'AST-001' }), /ATTENDANCE_DUPLICATE_ID/);
  assert.equal(rows.length, 1);
});

test('ATTENDANCE_EXPLICIT_PERSISTENCE_TEST createAttendance inserts into repository', () => {
  const rows = [];
  const created = service({ attendances: rows }).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' });
  assert.equal(created.ASISTENCIA_ID, 'AST-NEW');
  assert.equal(repositoryRows(rows).length, 1);
});

test('ATTENDANCE_RUNTIME_CONFIG_FAIL_CLOSED_TEST rejects invalid config before snapshot', () => {
  assert.throws(() => service({ configService: config({ RETARDO_VALOR: '1.2' }) }).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' }), /ATTENDANCE_CONFIG_RELATION_INVALID/);
});

test('ATTENDANCE_CONFIG_NO_PARTIAL_WRITE_TEST leaves repository unchanged when config is invalid', () => {
  const rows = [];
  assert.throws(() => service({ attendances: rows, configService: config({ RETARDO_VALOR: '1.2' }) }).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' }), /ATTENDANCE_CONFIG_RELATION_INVALID/);
  assert.equal(rows.length, 0);
});

test('ATTENDANCE_PENDING_NO_SCORE_TEST keeps F without score snapshots', () => {
  const record = service().createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'F' });
  assert.equal(record.VALOR_APLICADO, null);
  assert.equal(record.VALOR_MAXIMO_APLICADO, null);
});

test('SESSION_CLOSED_WRITE_TEST rejects normal capture in closed session', () => {
  assert.throws(() => service({ sessions: [session({ ESTADO: 'CERRADA' })] }).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'A' }), /SESSION_CLOSED/);
});

test('ATTENDANCE_SETUP_IDEMPOTENCY_TEST creates and preserves session attendance sheets', () => {
  const spreadsheet = fakeSpreadsheet();
  assert.equal(setupAttendanceSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.equal(setupAttendanceSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.ok(spreadsheet.sheets.SESIONES.rows[0].includes('SESION_ID'));
});

test('master and attendance setup can coexist idempotently', () => {
  const spreadsheet = fakeSpreadsheet();
  setupMasterDataSheets(spreadsheet, setupSheetWithHeaders);
  setupAttendanceSheets(spreadsheet, setupSheetWithHeaders);
  assert.ok(spreadsheet.sheets.ALUMNOS);
  assert.ok(spreadsheet.sheets.ASISTENCIAS);
});
