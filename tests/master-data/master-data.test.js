const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { setupSheetWithHeaders } = require('../../src/common/SheetSetup');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
require('../../src/domain/MasterDataContracts');
const { setupMasterDataSheets } = require('../../src/config/MasterDataSetup');
const { createMasterDataService } = require('../../src/services/MasterDataService');

function student(overrides = {}) {
  return {
    ALUMNO_ID: 'ALU-001',
    ACTIVO: true,
    NOMBRE: 'Nombre',
    APELLIDOS: 'Ficticio',
    GRADO: 'G1',
    GRUPO: 'X',
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
    NOMBRE_TUTOR: 'Tutor Ficticio',
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

function service(students = [student()], tutors = [tutor()]) {
  return createMasterDataService({
    studentRepository: createArrayRepository(students),
    tutorRepository: createArrayRepository(tutors),
    utils
  });
}

function fakeSheet(rows = []) {
  return {
    rows,
    getLastRow() {
      return rows.length;
    },
    getRange(row, column, rowCount, columnCount) {
      return {
        getValues() {
          return rows.slice(row - 1, row - 1 + rowCount).map((sourceRow) => sourceRow.slice(column - 1, column - 1 + columnCount));
        },
        setValues(values) {
          for (let index = 0; index < rowCount; index += 1) {
            rows[row - 1 + index] = values[index].slice();
          }
        }
      };
    }
  };
}

function fakeSpreadsheet() {
  const sheets = {};
  return {
    sheets,
    getSheetByName(name) {
      return sheets[name] || null;
    },
    insertSheet(name) {
      sheets[name] = fakeSheet();
      return sheets[name];
    }
  };
}

test('STUDENT_SCHEMA_TEST validates required student fields', () => {
  assert.equal(service().getStudents()[0].nombre, 'Nombre');
  assert.throws(() => service([student({ NOMBRE: ' ' })]).getStudents(), /REQUIRED_FIELD: NOMBRE/);
});

test('STUDENT_ID_UNIQUENESS_TEST rejects duplicate ALUMNO_ID', () => {
  assert.throws(() => service([student(), student({ NOMBRE: 'Otro' })]).getStudents(), /STUDENT_DUPLICATE_ID/);
});

test('STUDENT_ENUMS_TEST validates student enum fields', () => {
  assert.throws(() => service([student({ NIVEL: 'C1' })]).getStudents(), /INVALID_ENUM: NIVEL/);
  assert.throws(() => service([student({ POSICION_PRINCIPAL: 'ARQ' })]).getStudents(), /INVALID_ENUM/);
});

test('STUDENT_DATE_RANGE_TEST rejects baja before alta', () => {
  assert.throws(() => service([student({ FECHA_BAJA: '2025-12-31' })]).getStudents(), /INVALID_DATE_RANGE/);
});

test('MASTER_DATA_REAL_SHEETS_NUMERIC_GRADE_TEST', () => {
  const result = service([student({ GRADO: 1, FECHA_ALTA: new Date(2026, 0, 1) })]).getStudents();
  assert.equal(result[0].grado, '1');
});

test('MASTER_DATA_GRADE_STRING_COMPATIBILITY_TEST', () => {
  assert.equal(service([student({ GRADO: '1' })]).getStudents()[0].grado, '1');
  assert.equal(service([student({ GRADO: ' 1 ' })]).getStudents()[0].grado, '1');
  assert.equal(service([student({ GRADO: 'PREPA' })]).getStudents()[0].grado, 'PREPA');
});

test('MASTER_DATA_GRADE_INVALID_TYPE_TEST', () => {
  [true, false, new Date(2026, 0, 1), {}, [], NaN, Infinity].forEach((value) => {
    assert.throws(() => service([student({ GRADO: value })]).getStudents(), /INVALID_GRADE: GRADO/);
  });
  [undefined, null, ''].forEach((value) => {
    assert.throws(() => service([student({ GRADO: value })]).getStudents(), /REQUIRED_FIELD: GRADO/);
  });
});

test('TUTOR_SCHEMA_TEST validates required tutor fields', () => {
  assert.equal(service().getTutors()[0].email, 'family@example.invalid');
  assert.throws(() => service([student()], [tutor({ NOMBRE_TUTOR: '' })]).getTutors(), /REQUIRED_FIELD: NOMBRE_TUTOR/);
});

test('TUTOR_ID_UNIQUENESS_TEST rejects duplicate TUTOR_ID', () => {
  assert.throws(() => service([student()], [tutor(), tutor({ ALUMNO_ID: 'ALU-001', EMAIL: 'other@example.invalid' })]).getTutors(), /TUTOR_DUPLICATE_ID/);
});

test('TUTOR_STUDENT_FK_TEST requires an existing ALUMNO_ID', () => {
  assert.throws(() => service([student()], [tutor({ ALUMNO_ID: 'ALU-404' })]).getTutors(), /TUTOR_STUDENT_FK/);
});

test('TUTOR_PRINCIPAL_UNIQUENESS_TEST allows only one active principal per student', () => {
  assert.throws(() => service([student()], [tutor(), tutor({ TUTOR_ID: 'TUT-002', EMAIL: 'two@example.invalid' })]).getTutors(), /TUTOR_DUPLICATE_PRINCIPAL/);
});

test('TUTOR_EMAIL_REQUIREMENT_TEST requires email for selected communications', () => {
  assert.throws(() => service([student()], [tutor({ EMAIL: '', RECIBE_AUSENCIAS: true })]).getTutors(), /TUTOR_EMAIL_REQUIRED/);
  assert.equal(service([student()], [tutor({ EMAIL: '', RECIBE_AUSENCIAS: false, RECIBE_CONVOCATORIAS: false })]).getTutors()[0].email, '');
});

test('TUTOR_OPTIONAL_EMAIL_FORMAT_TEST validates optional email when present', () => {
  assert.throws(() => service([student()], [tutor({ EMAIL: 'bad-email', RECIBE_AUSENCIAS: false, RECIBE_CONVOCATORIAS: false })]).getTutors(), /TUTOR_EMAIL_INVALID/);
  assert.equal(service([student()], [tutor({ EMAIL: 'optional@example.invalid', RECIBE_AUSENCIAS: false, RECIBE_CONVOCATORIAS: false })]).getTutors()[0].email, 'optional@example.invalid');
});

test('COMMUNICATION_READINESS_TEST reports readiness without blocking persistence', () => {
  const readiness = service([student()], [tutor({ RECIBE_AUSENCIAS: true, RECIBE_CONVOCATORIAS: false })]).getCommunicationReadiness()[0];
  assert.equal(readiness.ausenciasReady, true);
  assert.equal(readiness.convocatoriasReady, false);
});

test('MASTER_DATA_SETUP_IDEMPOTENCY_TEST creates headers and preserves existing data', () => {
  const spreadsheet = fakeSpreadsheet();
  assert.equal(setupMasterDataSheets(spreadsheet, setupSheetWithHeaders), true);
  const alumnoRows = spreadsheet.sheets.ALUMNOS.rows.slice();
  assert.equal(setupMasterDataSheets(spreadsheet, setupSheetWithHeaders), true);
  assert.deepEqual(spreadsheet.sheets.ALUMNOS.rows, alumnoRows);
});
