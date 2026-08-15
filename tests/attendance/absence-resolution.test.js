const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
require('../../src/domain/AttendanceContracts');
require('../../src/domain/AttendanceConfigPolicy');
require('../../src/domain/AttendanceSnapshotValidator');
const { createConfigService } = require('../../src/config/ConfigService');
const { createAttendanceFoundationService } = require('../../src/services/AttendanceFoundationService');
const { createAbsenceResolutionService } = require('../../src/services/AbsenceResolutionService');
const { completeConfigRows } = require('../config/config-fixtures');

function config(overrides = {}) {
  return createConfigService(createConfigRepository(completeConfigRows(overrides)));
}

function session() {
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
    CERRADA_EN: ''
  };
}

function pendingAbsence(overrides = {}) {
  return {
    ASISTENCIA_ID: 'AST-001',
    SESION_ID: 'SES-001',
    ALUMNO_ID: 'ALU-001',
    ESTADO: 'F',
    VALOR_APLICADO: null,
    VALOR_MAXIMO_APLICADO: null,
    REGISTRADO_EN: new Date('2026-01-02T10:00:00Z'),
    LIMITE_JUSTIFICACION: new Date('2026-01-03T10:00:00Z'),
    MODIFICADO_EN: '',
    JUSTIFICACION: '',
    AVISO_ENVIADO: false,
    COMUNICACION_ID: '',
    OBSERVACIONES: '',
    ...overrides
  };
}

function foundation(configService = config()) {
  return createAttendanceFoundationService({
    attendanceRepository: createArrayRepository([]),
    clock: { now: () => new Date('2026-01-02T10:00:00Z') },
    configService,
    idGenerator: { attendanceId: () => 'AST-001' },
    sessionRepository: createArrayRepository([session()]),
    studentRepository: createArrayRepository([{ ALUMNO_ID: 'ALU-001' }]),
    utils
  });
}

function resolver(rows = [pendingAbsence()], tutors = [], configService = config()) {
  return createAbsenceResolutionService({
    attendanceRepository: createArrayRepository(rows),
    clock: { now: () => new Date('2026-01-02T12:00:00Z') },
    configService,
    tutorRepository: createArrayRepository(tutors),
    utils
  });
}

function copyOnReadRepository(rows) {
  const internal = rows.map((row) => ({ ...row }));
  return {
    getAll() {
      return internal.map((row) => ({ ...row }));
    },
    updateById(idField, id, nextRecord) {
      const index = internal.findIndex((row) => row[idField] === id);
      if (index === -1) throw new Error(`REPOSITORY_RECORD_NOT_FOUND: ${id}`);
      internal[index] = { ...nextRecord };
      return { ...internal[index] };
    }
  };
}

function resolverWithRepository(repository, configService = config()) {
  return createAbsenceResolutionService({
    attendanceRepository: repository,
    clock: { now: () => new Date('2026-01-02T12:00:00Z') },
    configService,
    tutorRepository: createArrayRepository([]),
    utils
  });
}

test('ABSENCE_DEADLINE_CONFIG_TEST stores deadline from dynamic CONFIG', () => {
  const record = foundation(config({ HORAS_JUSTIFICACION: '2' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'F' });
  assert.equal(record.LIMITE_JUSTIFICACION.toISOString(), '2026-01-02T12:00:00.000Z');
});

test('ABSENCE_JUSTIFIED_WITHIN_WINDOW_TEST resolves F to FJ', () => {
  const result = resolver().resolveAbsence('AST-001', 'FJ', { now: new Date('2026-01-02T12:00:00Z'), reason: 'DOC' });
  assert.equal(result.attendance.ESTADO, 'FJ');
});

test('ABSENCE_INJURY_WITHIN_WINDOW_TEST resolves F to LES', () => {
  const result = resolver().resolveAbsence('AST-001', 'LES', { now: new Date('2026-01-02T12:00:00Z') });
  assert.equal(result.attendance.ESTADO, 'LES');
});

test('ABSENCE_EXPIRED_TO_FI_TEST resolves expired absence to FI', () => {
  const result = resolver().resolveExpiredAbsences(new Date('2026-01-04T10:00:00Z'));
  assert.equal(result[0].attendance.ESTADO, 'FI');
});

test('ABSENCE_LATE_JUSTIFICATION_REJECTED_TEST converts late FJ request to FI', () => {
  const result = resolver().resolveAbsence('AST-001', 'FJ', { now: new Date('2026-01-04T10:00:00Z') });
  assert.equal(result.attendance.ESTADO, 'FI');
});

test('ABSENCE_INVALID_TRANSITION_TEST rejects finalized source states', () => {
  assert.throws(() => resolver([pendingAbsence({ ESTADO: 'A' })]).resolveAbsence('AST-001', 'FJ'), /ABSENCE_INVALID_TRANSITION/);
});

test('ABSENCE_VALUE_SNAPSHOT_TEST applies configured final snapshots', () => {
  const result = resolver([pendingAbsence()], [], config({ FALTA_INJUSTIFICADA_VALOR: '0' })).resolveAbsence('AST-001', 'FI');
  assert.equal(result.attendance.VALOR_APLICADO, 0);
  assert.equal(result.attendance.VALOR_MAXIMO_APLICADO, 1);
});

test('ABSENCE_DEADLINE_SNAPSHOT_TEST keeps existing deadline after CONFIG changes', () => {
  const record = foundation(config({ HORAS_JUSTIFICACION: '2' })).createAttendance({ sesionId: 'SES-001', alumnoId: 'ALU-001', estado: 'F' });
  const before = record.LIMITE_JUSTIFICACION.toISOString();
  config({ HORAS_JUSTIFICACION: '3' });
  assert.equal(record.LIMITE_JUSTIFICACION.toISOString(), before);
});

test('ABSENCE_EXPIRATION_IDEMPOTENCY_TEST does not reprocess finalized rows', () => {
  const rows = [pendingAbsence()];
  const service = resolver(rows);
  assert.equal(service.resolveExpiredAbsences(new Date('2026-01-04T10:00:00Z')).length, 1);
  assert.equal(service.resolveExpiredAbsences(new Date('2026-01-04T10:00:00Z')).length, 0);
});

test('ABSENCE_NOTIFICATION_INTENT_TEST prepares intent without sending email', () => {
  const result = resolver([pendingAbsence()], [{ TUTOR_ID: 'TUT-001', ALUMNO_ID: 'ALU-001', EMAIL: 'family@example.invalid', ACTIVO: true, RECIBE_AUSENCIAS: true }]).prepareAbsenceNotificationIntents('AST-001');
  assert.equal(result.intents[0].TYPE, 'AUSENCIA');
  assert.equal(result.intents[0].RECIPIENT_EMAIL, 'family@example.invalid');
});

test('ABSENCE_NO_RECIPIENT_WARNING_TEST warns without blocking attendance', () => {
  const result = resolver().prepareAbsenceNotificationIntents('AST-001');
  assert.deepEqual(result.warnings, ['NO_ELIGIBLE_RECIPIENT']);
});

test('ABSENCE_EXPLICIT_PERSISTENCE_TEST persists FJ through updateById', () => {
  const repository = copyOnReadRepository([pendingAbsence()]);
  resolverWithRepository(repository).resolveAbsence('AST-001', 'FJ', { now: new Date('2026-01-02T12:00:00Z') });
  assert.equal(repository.getAll()[0].ESTADO, 'FJ');
});

test('ABSENCE_COPY_ON_READ_IDEMPOTENCY_TEST persists FI and skips second expiration', () => {
  const repository = copyOnReadRepository([pendingAbsence()]);
  const service = resolverWithRepository(repository);
  assert.equal(service.resolveExpiredAbsences(new Date('2026-01-04T10:00:00Z')).length, 1);
  assert.equal(repository.getAll()[0].ESTADO, 'FI');
  assert.equal(service.resolveExpiredAbsences(new Date('2026-01-04T10:00:00Z')).length, 0);
});

test('ABSENCE_RUNTIME_CONFIG_FAIL_CLOSED_TEST rejects invalid config and preserves F', () => {
  const repository = copyOnReadRepository([pendingAbsence()]);
  assert.throws(() => resolverWithRepository(repository, config({ RETARDO_VALOR: '1.2' })).resolveAbsence('AST-001', 'FJ'), /ATTENDANCE_CONFIG_RELATION_INVALID/);
  assert.equal(repository.getAll()[0].ESTADO, 'F');
});

test('ABSENCE_NO_DEFERRED_AUDIT_MARKER_TEST does not expose deferred audit marker', () => {
  const result = resolver().resolveAbsence('AST-001', 'FJ', { now: new Date('2026-01-02T12:00:00Z') });
  assert.equal(result.audit.AUDIT_PERSISTENCE, undefined);
});
