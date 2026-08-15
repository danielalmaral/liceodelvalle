const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
require('../../src/domain/AuditContracts');
const { createAuditService } = require('../../src/services/AuditService');
const { createOperationalCommandService } = require('../../src/services/OperationalCommandService');

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

test('AUDIT_SAME_ID_SAME_PAYLOAD_IDEMPOTENT_TEST returns existing event idempotently', () => {
  const audit = service([event()]);
  assert.equal(audit.appendEvent(event()).VALOR_NUEVO, 'FJ');
});

test('AUDIT_SAME_ID_DIFFERENT_PAYLOAD_CONFLICT_TEST rejects reused id with different payload', () => {
  const audit = service([event()]);
  assert.throws(() => audit.appendEvent(event({ VALOR_NUEVO: 'FI' })), /AUDIT_EVENT_ID_CONFLICT/);
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

function auditedCommandState(overrides = {}) {
  const attendanceRows = [{ ASISTENCIA_ID: 'AST-001', ESTADO: 'F' }];
  const detailRows = [{ DETALLE_ID: 'DET-001', CONVOCATORIA_ID: 'CON-001', ALUMNO_ID: 'ALU-001', SELECCIONADO_FINAL: true, POSICION_ASIGNADA: 'DEF' }];
  const participationRows = [{ PARTICIPACION_ID: 'PRT-001', MINUTOS_JUGADOS: 0 }];
  const communicationRows = [{ COMUNICACION_ID: 'COM-001', ESTADO: 'ERROR' }];
  const auditRows = [];
  let participationWriteCount = 0;
  const auditRepository = overrides.auditRepository || createArrayRepository(auditRows);
  const services = {
    absenceResolutionService: {
      resolveAbsence(id, state) {
        attendanceRows[0].ESTADO = state;
        return { attendance: attendanceRows[0] };
      },
      resolveExpiredAbsences() {
        attendanceRows[0].ESTADO = 'FI';
        return [{ attendance: attendanceRows[0] }];
      }
    },
    auditService: createAuditService({ auditRepository, utils }),
    communicationService: {
      sendPendingCommunications() { return [{ communication: { COMUNICACION_ID: 'COM-001', ESTADO: 'ENVIADO' } }]; },
      retryCommunication() { return { communication: { COMUNICACION_ID: 'COM-001', ESTADO: 'ERROR' } }; }
    },
    convocationService: {
      approveConvocation() { return { CONVOCATORIA_ID: 'CON-001', ESTADO: 'APROBADA' }; },
      assignPlayerPosition() { detailRows[0].POSICION_ASIGNADA = 'MED'; return detailRows[0]; },
      setFinalSelection() { detailRows[0].SELECCIONADO_FINAL = false; return detailRows[0]; }
    },
    participationService: {
      updateParticipation(id, updates) { participationWriteCount += 1; Object.assign(participationRows[0], updates); return participationRows[0]; }
    }
  };
  return {
    auditRows,
    getParticipationWriteCount() { return participationWriteCount; },
    participationRows,
    command: createOperationalCommandService({
      idGenerator: overrides.idGenerator || { operationId: (prefix) => `${prefix}-001` },
      repositories: {
        attendanceRepository: createArrayRepository(attendanceRows),
        communicationRepository: createArrayRepository(communicationRows),
        detailRepository: createArrayRepository(detailRows),
        participationRepository: createArrayRepository(participationRows)
      },
      services,
      utils
    })
  };
}

test('AUDIT_E2E_ABSENCE_FJ_TEST records audit through absence command', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-FJ' });
  assert.equal(state.auditRows[0].VALOR_NUEVO, 'FJ');
});

test('OPERATION_ID_GENERATOR_REQUIRED_TEST requires durable operation id generator', () => {
  assert.throws(() => createOperationalCommandService({ repositories: {}, services: {}, utils }), /RUNTIME_OPERATION_ID_GENERATOR_REQUIRED/);
});

test('OPERATION_ID_GENERATED_DISTINCT_TEST uses generator for distinct operation ids', () => {
  let index = 0;
  const state = auditedCommandState({ idGenerator: { operationId: () => { index += 1; return `OP-GEN-${index}`; } } });
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision');
  state.command.setFinalSelection('CON-001', 'ALU-001', true, 'Decision');
  assert.notEqual(state.auditRows[0].EVENTO_ID, state.auditRows[1].EVENTO_ID);
});

test('AUDIT_E2E_ABSENCE_FI_TEST records expired FI through command', () => {
  const state = auditedCommandState();
  state.command.resolveExpiredAbsences(new Date(), { operationId: 'OP-FI' });
  assert.equal(state.auditRows[0].VALOR_NUEVO, 'FI');
});

test('AUDIT_E2E_ABSENCE_LES_TEST records LES through command', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'LES', { operationId: 'OP-LES' });
  assert.equal(state.auditRows[0].VALOR_NUEVO, 'LES');
});

test('AUDIT_E2E_CONVOCATION_SELECTION_TEST records selection command', () => {
  const state = auditedCommandState();
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision', { operationId: 'OP-SEL' });
  assert.equal(state.auditRows[0].CAMPO, 'SELECCIONADO_FINAL');
});

test('AUDIT_E2E_CONVOCATION_POSITION_TEST records position command', () => {
  const state = auditedCommandState();
  state.command.assignPlayerPosition('CON-001', 'ALU-001', 'MED', 'Decision', { operationId: 'OP-POS' });
  assert.equal(state.auditRows[0].CAMPO, 'POSICION_ASIGNADA');
});

test('AUDIT_E2E_CONVOCATION_APPROVAL_TEST records approval command', () => {
  const state = auditedCommandState();
  state.command.approveConvocation('CON-001', 'coach', { operationId: 'OP-APP' });
  assert.equal(state.auditRows[0].ACCION, 'APROBACION');
});

test('AUDIT_E2E_PARTICIPATION_UPDATE_TEST records participation update command', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 30 }, { operationId: 'OP-PRT' });
  assert.equal(state.auditRows[0].ENTIDAD, 'PARTICIPACION_PARTIDO');
});

test('AUDIT_E2E_COMMUNICATION_SENT_TEST records communication sent command', () => {
  const state = auditedCommandState();
  state.command.sendPendingCommunications({ operationId: 'OP-COM' });
  assert.equal(state.auditRows[0].VALOR_NUEVO, 'ENVIADO');
});

test('AUDIT_E2E_COMMUNICATION_ERROR_TEST records communication retry command', () => {
  const state = auditedCommandState();
  state.command.retryCommunication('COM-001', { operationId: 'OP-COM-ERR' });
  assert.equal(state.auditRows[0].VALOR_NUEVO, 'ERROR');
});

test('AUDIT_NO_EVENT_ON_DOMAIN_FAILURE_TEST does not append if command write fails', () => {
  const state = auditedCommandState();
  state.command = createOperationalCommandService({
    idGenerator: { operationId: () => 'OP-DOMAIN-FAIL' },
    repositories: {
      attendanceRepository: createArrayRepository([{ ASISTENCIA_ID: 'AST-001', ESTADO: 'F' }]),
      detailRepository: createArrayRepository([]),
      participationRepository: createArrayRepository([])
    },
    services: {
      absenceResolutionService: { resolveAbsence() { throw new Error('domain failed'); } },
      auditService: createAuditService({ auditRepository: createArrayRepository(state.auditRows), utils })
    },
    utils
  });
  assert.throws(() => state.command.resolveAbsence('AST-001', 'FJ'), /domain failed/);
  assert.equal(state.auditRows.length, 0);
});

test('AUDIT_FAILURE_AFTER_WRITE_E2E_TEST fails when audit append fails after write', () => {
  const state = auditedCommandState({
    auditRepository: {
      getAll() { return []; },
      insert() { throw new Error('audit failed'); }
    }
  });
  assert.throws(() => state.command.resolveAbsence('AST-001', 'FJ'), /AUDIT_PERSISTENCE_FAILED_AFTER_WRITE/);
});

test('AUDIT_SAME_OPERATION_RETRY_IDEMPOTENT_TEST does not repeat domain write for same operation payload', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-SAME' });
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-SAME' });
  assert.equal(state.auditRows.length, 1);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('OPERATION_ID_DIFFERENT_PAYLOAD_CONFLICT_TEST rejects replay with different intent before write', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-SAME' });
  assert.throws(() => state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 20 }, { operationId: 'OP-SAME' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.participationRows[0].MINUTOS_JUGADOS, 10);
});

test('OPERATION_ID_REPLAY_NO_SECOND_WRITE_TEST replays without a second domain write', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-REPLAY' });
  const result = state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('AUDIT_TWO_MANUAL_CHANGES_SAME_FIELD_TEST creates distinct events for distinct operations', () => {
  const state = auditedCommandState();
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision', { operationId: 'OP-1' });
  state.command.setFinalSelection('CON-001', 'ALU-001', true, 'Decision', { operationId: 'OP-2' });
  assert.equal(state.auditRows.length, 2);
});

test('AUDIT_TWO_PARTICIPATION_UPDATES_SAME_FIELD_TEST creates distinct participation events', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-1' });
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 20 }, { operationId: 'OP-2' });
  assert.equal(state.auditRows.length, 2);
});

test('AUDIT_DISTINCT_EVENT_ID_TEST creates distinct event ids for distinct operations', () => {
  const state = auditedCommandState();
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision', { operationId: 'OP-1' });
  state.command.setFinalSelection('CON-001', 'ALU-001', true, 'Decision', { operationId: 'OP-2' });
  assert.notEqual(state.auditRows[0].EVENTO_ID, state.auditRows[1].EVENTO_ID);
});

test('AUDIT_MULTIPLE_COMMUNICATION_ERROR_ATTEMPTS_TEST creates one event per distinct error operation', () => {
  const state = auditedCommandState();
  state.command.retryCommunication('COM-001', { operationId: 'OP-1' });
  state.command.retryCommunication('COM-001', { operationId: 'OP-2' });
  assert.equal(state.auditRows.length, 2);
});

test('AUDIT_PARTICIPATION_MULTI_FIELD_TEST records one event per changed user field', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10, GOLES: 1, AMARILLAS: 1 }, { operationId: 'OP-MULTI' });
  assert.deepEqual(state.auditRows.map((row) => row.CAMPO).sort(), ['AMARILLAS', 'GOLES', 'MINUTOS_JUGADOS']);
});

test('AUDIT_PARTICIPATION_ONLY_CHANGED_FIELDS_TEST skips unchanged and modified timestamp fields', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 0, MODIFICADO_EN: '2026-02-02' }, { operationId: 'OP-NOCHANGE' });
  assert.equal(state.auditRows.length, 0);
});

test('AUDIT_ABSENCE_REASON_NOT_DUPLICATED_TEST stores safe absence motive only', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-ABS', reason: 'Doctor note with private detail' });
  assert.equal(state.auditRows[0].MOTIVO, 'ABSENCE_JUSTIFIED');
});

test('AUDIT_MEDICAL_TEXT_REDACTED_TEST redacts medical text field values', () => {
  const record = service().appendEvent(event({ CAMPO: 'JUSTIFICACION', VALOR_ANTERIOR: 'dolor privado', VALOR_NUEVO: 'lesion privada', MOTIVO: 'STATUS_CHANGE' }));
  assert.equal(record.VALOR_ANTERIOR, '[REDACTED]');
  assert.equal(record.VALOR_NUEVO, '[REDACTED]');
});

test('AUDIT_FREE_TEXT_FIELD_REDACTION_TEST redacts known free-text fields', () => {
  const record = service().appendEvent(event({ CAMPO: 'OBSERVACIONES', VALOR_ANTERIOR: 'texto libre', VALOR_NUEVO: 'otro texto', MOTIVO: 'STATUS_CHANGE' }));
  assert.equal(record.VALOR_ANTERIOR, '[REDACTED]');
  assert.equal(record.VALOR_NUEVO, '[REDACTED]');
});

test('AUDIT_MULTI_ITEM_REPOSITORY_ORDER_INVARIANT_TEST uses entity ids for batch audit ids', () => {
  function run(rows) {
    const auditRows = [];
    const command = createOperationalCommandService({
      idGenerator: { operationId: () => 'OP-BATCH' },
      repositories: { communicationRepository: createArrayRepository(rows) },
      services: {
        auditService: createAuditService({ auditRepository: createArrayRepository(auditRows), utils }),
        communicationService: {
          sendPendingCommunications() {
            return rows.map((row) => ({ communication: { COMUNICACION_ID: row.COMUNICACION_ID, ESTADO: 'ENVIADO' } }));
          }
        }
      },
      utils
    });
    command.sendPendingCommunications();
    return auditRows.map((row) => row.EVENTO_ID).sort();
  }
  const a = communicationId => ({ COMUNICACION_ID: communicationId, ESTADO: 'PENDIENTE' });
  assert.deepEqual(run([a('COM-001'), a('COM-002')]), run([a('COM-002'), a('COM-001')]));
});
