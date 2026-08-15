const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
require('../../src/domain/AuditContracts');
const { createAuditService } = require('../../src/services/AuditService');

function service(rows = [], overrides = {}) {
  return createAuditService({
    auditRepository: overrides.repository || createArrayRepository(rows),
    clock: { now: () => new Date('2026-02-01T12:00:00Z') },
    idGenerator: { auditId: () => 'AUD-001' },
    utils
  });
}

function event(overrides = {}) {
  return {
    EVENTO_ID: 'AUD-001',
    USUARIO: 'coach',
    ENTIDAD: 'ASISTENCIAS',
    ENTIDAD_ID: 'AST-001',
    ACCION: 'TRANSICION_AUSENCIA',
    CAMPO: 'ESTADO',
    VALOR_ANTERIOR: 'F',
    VALOR_NUEVO: 'FJ',
    MOTIVO: 'DOC',
    ...overrides
  };
}

test('AUDIT_SCHEMA_TEST appends normalized audit event', () => {
  assert.equal(service().appendEvent(event()).EVENTO_ID, 'AUD-001');
});

test('AUDIT_APPEND_ONLY_TEST exposes append-only service API', () => {
  const audit = service();
  assert.equal(typeof audit.appendEvent, 'function');
  assert.equal(audit.updateEvent, undefined);
  assert.equal(audit.deleteEvent, undefined);
});

test('AUDIT_EVENT_ID_UNIQUENESS_TEST returns existing event idempotently', () => {
  const audit = service([event()]);
  assert.equal(audit.appendEvent(event({ VALOR_NUEVO: 'FI' })).VALOR_NUEVO, 'FJ');
});

test('AUDIT_ABSENCE_TRANSITION_TEST records F transitions', () => {
  const record = service().recordAbsenceTransition('AST-001', 'F', 'FI', 'coach', 'expired');
  assert.equal(record.ACCION, 'TRANSICION_AUSENCIA');
});

test('AUDIT_CONVOCATION_MANUAL_CHANGE_TEST records manual selection field', () => {
  const record = service().recordConvocationManualChange('DET-001', 'SELECCIONADO_FINAL', true, false, 'coach', 'rotacion');
  assert.equal(record.ENTIDAD, 'CONVOCATORIA_DETALLE');
});

test('AUDIT_CONVOCATION_APPROVAL_TEST records approval event', () => {
  assert.equal(service().recordConvocationApproval('CON-001', 'coach').VALOR_NUEVO, 'APROBADA');
});

test('AUDIT_PARTICIPATION_UPDATE_TEST records post-match update', () => {
  assert.equal(service().recordParticipationUpdate('PRT-001', 'MINUTOS_JUGADOS', 0, 45, 'coach').ENTIDAD, 'PARTICIPACION_PARTIDO');
});

test('AUDIT_COMMUNICATION_STATE_TEST records send state changes', () => {
  assert.equal(service().recordCommunicationState('COM-001', 'PENDIENTE', 'ENVIADO').ENTIDAD, 'COMUNICACIONES');
});

test('AUDIT_PII_SANITIZATION_TEST removes sensitive content', () => {
  const record = service().appendEvent(event({ VALOR_NUEVO: 'family@example.invalid', MOTIVO: 'contact family@example.invalid' }));
  assert.equal(record.VALOR_NUEVO.includes('@example.invalid'), false);
  assert.equal(record.MOTIVO.includes('@example.invalid'), false);
});

test('AUDIT_IDEMPOTENCY_TEST avoids duplicate retry events', () => {
  const rows = [];
  const audit = service(rows);
  audit.appendEvent(event());
  audit.appendEvent(event());
  assert.equal(rows.length, 1);
});

test('AUDIT_FAILURE_AFTER_WRITE_TEST reports failed audit after domain write', () => {
  let wrote = false;
  const audit = service([], {
    repository: {
      getAll() { return []; },
      insert() { throw new Error('storage failed'); }
    }
  });
  assert.throws(() => audit.appendAfterWrite(() => { wrote = true; return true; }, event()), /AUDIT_PERSISTENCE_FAILED_AFTER_WRITE/);
  assert.equal(wrote, true);
});
