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
  let absenceWriteCount = 0;
  let approvalWriteCount = 0;
  let communicationSendCount = 0;
  let createParticipationWriteCount = 0;
  let participationWriteCount = 0;
  let positionWriteCount = 0;
  let retrySendCount = 0;
  let selectionWriteCount = 0;
  const auditRepository = overrides.auditRepository || createArrayRepository(auditRows);
  const services = {
    absenceResolutionService: {
      resolveAbsence(id, state) {
        absenceWriteCount += 1;
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
      sendPendingCommunications() { communicationSendCount += 1; return [{ communication: { COMUNICACION_ID: 'COM-001', ESTADO: 'ENVIADO' } }]; },
      retryCommunication() { retrySendCount += 1; return { communication: { COMUNICACION_ID: 'COM-001', ESTADO: 'ERROR' } }; }
    },
    convocationService: {
      approveConvocation() { approvalWriteCount += 1; return { CONVOCATORIA_ID: 'CON-001', ESTADO: 'APROBADA' }; },
      assignPlayerPosition() { positionWriteCount += 1; detailRows[0].POSICION_ASIGNADA = 'MED'; return detailRows[0]; },
      setFinalSelection() { selectionWriteCount += 1; detailRows[0].SELECCIONADO_FINAL = false; return detailRows[0]; }
    },
    participationService: {
      createParticipation(input) { createParticipationWriteCount += 1; participationRows.push(input); return input; },
      updateParticipation(id, updates) { participationWriteCount += 1; Object.assign(participationRows[0], updates); return participationRows[0]; }
    }
  };
  return {
    auditRows,
    attendanceRows,
    communicationRows,
    detailRows,
    getAbsenceWriteCount() { return absenceWriteCount; },
    getApprovalWriteCount() { return approvalWriteCount; },
    getCommunicationSendCount() { return communicationSendCount; },
    getCreateParticipationWriteCount() { return createParticipationWriteCount; },
    getParticipationWriteCount() { return participationWriteCount; },
    getPositionWriteCount() { return positionWriteCount; },
    getRetrySendCount() { return retrySendCount; },
    getSelectionWriteCount() { return selectionWriteCount; },
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

function functionalEvents(rows) {
  return rows.filter((row) => row.ENTIDAD !== 'OPERACION');
}

function operationEvents(rows) {
  return rows.filter((row) => row.ENTIDAD === 'OPERACION');
}

test('AUDIT_E2E_ABSENCE_FJ_TEST records audit through absence command', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-FJ' });
  assert.equal(functionalEvents(state.auditRows)[0].VALOR_NUEVO, 'FJ');
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
  assert.equal(functionalEvents(state.auditRows)[0].VALOR_NUEVO, 'FI');
});

test('AUDIT_E2E_ABSENCE_LES_TEST records LES through command', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'LES', { operationId: 'OP-LES' });
  assert.equal(functionalEvents(state.auditRows)[0].VALOR_NUEVO, 'LES');
});

test('AUDIT_E2E_CONVOCATION_SELECTION_TEST records selection command', () => {
  const state = auditedCommandState();
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision', { operationId: 'OP-SEL' });
  assert.equal(functionalEvents(state.auditRows)[0].CAMPO, 'SELECCIONADO_FINAL');
});

test('AUDIT_E2E_CONVOCATION_POSITION_TEST records position command', () => {
  const state = auditedCommandState();
  state.command.assignPlayerPosition('CON-001', 'ALU-001', 'MED', 'Decision', { operationId: 'OP-POS' });
  assert.equal(functionalEvents(state.auditRows)[0].CAMPO, 'POSICION_ASIGNADA');
});

test('AUDIT_E2E_CONVOCATION_APPROVAL_TEST records approval command', () => {
  const state = auditedCommandState();
  state.command.approveConvocation('CON-001', 'coach', { operationId: 'OP-APP' });
  assert.equal(functionalEvents(state.auditRows)[0].ACCION, 'APROBACION');
});

test('AUDIT_E2E_PARTICIPATION_UPDATE_TEST records participation update command', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 30 }, { operationId: 'OP-PRT' });
  assert.equal(functionalEvents(state.auditRows)[0].ENTIDAD, 'PARTICIPACION_PARTIDO');
});

test('AUDIT_E2E_COMMUNICATION_SENT_TEST records communication sent command', () => {
  const state = auditedCommandState();
  state.command.sendPendingCommunications({ operationId: 'OP-COM' });
  assert.equal(functionalEvents(state.auditRows)[0].VALOR_NUEVO, 'ENVIADO');
});

test('AUDIT_E2E_COMMUNICATION_ERROR_TEST records communication retry command', () => {
  const state = auditedCommandState();
  state.command.retryCommunication('COM-001', { operationId: 'OP-COM-ERR' });
  assert.equal(functionalEvents(state.auditRows)[0].VALOR_NUEVO, 'ERROR');
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
  assert.equal(functionalEvents(state.auditRows).length, 1);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('OPERATION_ID_DIFFERENT_PAYLOAD_CONFLICT_TEST rejects replay with different intent before write', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-SAME' });
  assert.throws(() => state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 20 }, { operationId: 'OP-SAME' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.participationRows[0].MINUTOS_JUGADOS, 10);
});

test('OPERATION_CREATE_PARTICIPATION_DIFFERENT_PAYLOAD_CONFLICT_TEST rejects create replay with different payload', () => {
  const state = auditedCommandState({
    idGenerator: {
      operationId: () => 'OP-CREATE-DIFF',
      participationId: () => 'PRT-CREATE-DIFF'
    }
  });
  state.command.createParticipation({
    PARTIDO_ID: 'PAR-001',
    ALUMNO_ID: 'ALU-002',
    CONVOCATORIA_ID: 'CON-001',
    MINUTOS_JUGADOS: 20
  }, { operationId: 'OP-CREATE-DIFF' });
  assert.throws(() => state.command.createParticipation({
    PARTIDO_ID: 'PAR-001',
    ALUMNO_ID: 'ALU-002',
    CONVOCATORIA_ID: 'CON-001',
    MINUTOS_JUGADOS: 30
  }, { operationId: 'OP-CREATE-DIFF' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.getCreateParticipationWriteCount(), 1);
});

test('OPERATION_ABSENCE_DIFFERENT_REASON_CONFLICT_TEST rejects same absence with different reason fingerprint', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-ABS-REASON', reason: 'medical detail one' });
  assert.throws(() => state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-ABS-REASON', reason: 'medical detail two' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.getAbsenceWriteCount(), 1);
  assert.equal(state.auditRows.some((row) => String(row.VALOR_NUEVO).includes('medical detail')), false);
});

test('OPERATION_SELECTION_DIFFERENT_REASON_CONFLICT_TEST rejects same selection with different reason fingerprint', () => {
  const state = auditedCommandState();
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'reason one', { operationId: 'OP-SEL-REASON' });
  assert.throws(() => state.command.setFinalSelection('CON-001', 'ALU-001', false, 'reason two', { operationId: 'OP-SEL-REASON' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.getSelectionWriteCount(), 1);
});

test('OPERATION_UPDATE_FREE_TEXT_DIFFERENT_PAYLOAD_CONFLICT_TEST rejects changed free text by fingerprint', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { OBSERVACIONES: 'private note one' }, { operationId: 'OP-TEXT' });
  assert.throws(() => state.command.updateParticipation('PRT-001', { OBSERVACIONES: 'private note two' }, { operationId: 'OP-TEXT' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('OPERATION_ID_REPLAY_NO_SECOND_WRITE_TEST replays without a second domain write', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-REPLAY' });
  const result = state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('OPERATION_REPLAY_ABSENCE_NO_SECOND_WRITE_TEST replays absence without a second write', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-ABS-REPLAY' });
  const result = state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-ABS-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getAbsenceWriteCount(), 1);
});

test('OPERATION_REPLAY_SELECTION_NO_SECOND_WRITE_TEST replays selection without a second write', () => {
  const state = auditedCommandState();
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision', { operationId: 'OP-SEL-REPLAY' });
  const result = state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision', { operationId: 'OP-SEL-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getSelectionWriteCount(), 1);
});

test('OPERATION_REPLAY_POSITION_NO_SECOND_WRITE_TEST replays position without a second write', () => {
  const state = auditedCommandState();
  state.command.assignPlayerPosition('CON-001', 'ALU-001', 'MED', 'Decision', { operationId: 'OP-POS-REPLAY' });
  const result = state.command.assignPlayerPosition('CON-001', 'ALU-001', ' med ', 'Decision', { operationId: 'OP-POS-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getPositionWriteCount(), 1);
});

test('OPERATION_REPLAY_APPROVAL_NO_SECOND_WRITE_TEST replays approval without a second write', () => {
  const state = auditedCommandState();
  state.command.approveConvocation('CON-001', 'coach', { operationId: 'OP-APP-REPLAY' });
  const result = state.command.approveConvocation('CON-001', 'coach', { operationId: 'OP-APP-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getApprovalWriteCount(), 1);
});

test('OPERATION_REPLAY_PARTICIPATION_UPDATE_NO_SECOND_WRITE_TEST replays update without a second write', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-PRT-REPLAY' });
  const result = state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-PRT-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('OPERATION_REPLAY_PARTICIPATION_CREATE_NO_SECOND_WRITE_TEST replays create without a second write', () => {
  let generated = 0;
  const state = auditedCommandState({
    idGenerator: {
      operationId: () => 'OP-CREATE-REPLAY',
      participationId: () => {
        generated += 1;
        return `PRT-GEN-${generated}`;
      }
    }
  });
  state.command.createParticipation({ PARTIDO_ID: 'PAR-001', ALUMNO_ID: 'ALU-002', CONVOCATORIA_ID: 'CON-001' }, { operationId: 'OP-CREATE-REPLAY' });
  const result = state.command.createParticipation({ PARTIDO_ID: 'PAR-001', ALUMNO_ID: 'ALU-002', CONVOCATORIA_ID: 'CON-001' }, { operationId: 'OP-CREATE-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getCreateParticipationWriteCount(), 1);
  assert.equal(generated, 1);
});

test('OPERATION_REPLAY_COMMUNICATION_RETRY_NO_SECOND_SEND_TEST replays retry without a second send', () => {
  const state = auditedCommandState();
  state.command.retryCommunication('COM-001', { operationId: 'OP-RETRY-REPLAY' });
  const result = state.command.retryCommunication('COM-001', { operationId: 'OP-RETRY-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getRetrySendCount(), 1);
});

test('OPERATION_INTENT_LONG_PAYLOAD_REPLAY_TEST replays long intent without truncation conflict', () => {
  const state = auditedCommandState();
  const longReason = 'x'.repeat(260);
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-LONG', reason: longReason });
  const result = state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-LONG', reason: longReason });
  const intent = operationEvents(state.auditRows).filter((row) => row.CAMPO === 'INTENT')[0];
  assert.equal(result.idempotent, true);
  assert.equal(state.getAbsenceWriteCount(), 1);
  assert.equal(String(intent.VALOR_NUEVO).length < 180, true);
  assert.equal(String(intent.VALOR_NUEVO).includes(longReason), false);
});

test('OPERATION_INTENT_NO_PII_TEST stores no raw PII or free text in durable intent', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', {
    OBSERVACIONES: 'Call family@example.invalid at private-number with medical note',
    MINUTOS_JUGADOS: 5
  }, { operationId: 'OP-NO-PII' });
  const intentText = operationEvents(state.auditRows).map((row) => [row.VALOR_NUEVO, row.MOTIVO].join(' ')).join(' ');
  assert.equal(intentText.includes('family@example.invalid'), false);
  assert.equal(intentText.includes('private-number'), false);
  assert.equal(intentText.includes('medical note'), false);
  assert.equal(intentText.includes('Call'), false);
});

test('OPERATION_SEND_PENDING_REPLAY_NO_SECOND_SEND_TEST replays send batch without second send', () => {
  const communicationRows = [
    { COMUNICACION_ID: 'COM-001', ESTADO: 'PENDIENTE' },
    { COMUNICACION_ID: 'COM-002', ESTADO: 'PENDIENTE' }
  ];
  const auditRows = [];
  let sendCount = 0;
  const command = createOperationalCommandService({
    idGenerator: { operationId: () => 'OP-SEND-REPLAY' },
    repositories: { communicationRepository: createArrayRepository(communicationRows) },
    services: {
      auditService: createAuditService({ auditRepository: createArrayRepository(auditRows), utils }),
      communicationService: {
        sendPendingCommunications() {
          return communicationRows.filter((row) => row.ESTADO === 'PENDIENTE').map((row) => {
            sendCount += 1;
            row.ESTADO = 'ENVIADO';
            return { ok: true, communication: row };
          });
        }
      }
    },
    utils
  });
  command.sendPendingCommunications({ operationId: 'OP-SEND-REPLAY' });
  const replay = command.sendPendingCommunications({ operationId: 'OP-SEND-REPLAY' });
  assert.equal(replay.idempotent, true);
  assert.equal(sendCount, 2);
});

test('OPERATION_SEND_PENDING_OLD_ID_DOES_NOT_SEND_NEW_ROWS_TEST requires new operation id for new pending rows', () => {
  const communicationRows = [{ COMUNICACION_ID: 'COM-001', ESTADO: 'PENDIENTE' }];
  const auditRows = [];
  let sendCount = 0;
  const command = createOperationalCommandService({
    idGenerator: { operationId: () => 'OP-SEND-OLD' },
    repositories: { communicationRepository: createArrayRepository(communicationRows) },
    services: {
      auditService: createAuditService({ auditRepository: createArrayRepository(auditRows), utils }),
      communicationService: {
        sendPendingCommunications() {
          return communicationRows.filter((row) => row.ESTADO === 'PENDIENTE').map((row) => {
            sendCount += 1;
            row.ESTADO = 'ENVIADO';
            return { ok: true, communication: row };
          });
        }
      }
    },
    utils
  });
  command.sendPendingCommunications({ operationId: 'OP-SEND-OLD' });
  communicationRows.push({ COMUNICACION_ID: 'COM-002', ESTADO: 'PENDIENTE' });
  assert.equal(command.sendPendingCommunications({ operationId: 'OP-SEND-OLD' }).idempotent, true);
  assert.equal(sendCount, 1);
  command.sendPendingCommunications({ operationId: 'OP-SEND-NEW' });
  assert.equal(sendCount, 2);
});

test('AUDIT_COMPLETION_MARKER_REQUIRED_TEST writes intent functional events and completed marker', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-COMPLETE' });
  assert.equal(!!state.auditRows.find((row) => row.EVENTO_ID === 'AUD-OP-COMPLETE-OPERACION-INTENT'), true);
  assert.equal(!!state.auditRows.find((row) => row.EVENTO_ID === 'AUD-OP-COMPLETE-OPERACION-COMPLETED'), true);
  assert.equal(functionalEvents(state.auditRows).length, 1);
});

test('AUDIT_PARTIAL_APPEND_RECONCILIATION_TEST blocks retry after intent-only partial audit', () => {
  const auditRows = [];
  let inserts = 0;
  const state = auditedCommandState({
    auditRepository: {
      getAll() { return auditRows; },
      insert(record) {
        inserts += 1;
        if (inserts === 2) {
          throw new Error('functional append failed');
        }
        auditRows.push(record);
        return record;
      }
    }
  });
  assert.throws(() => state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-PARTIAL' }), /AUDIT_PERSISTENCE_FAILED_AFTER_WRITE/);
  assert.throws(() => state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-PARTIAL' }), /AUDIT_RECONCILIATION_REQUIRED/);
  assert.equal(state.getAbsenceWriteCount(), 1);
});

test('AUDIT_PARTIAL_MULTI_EVENT_RECONCILIATION_TEST blocks retry after incomplete multi-event audit', () => {
  const auditRows = [];
  let inserts = 0;
  const state = auditedCommandState({
    auditRepository: {
      getAll() { return auditRows; },
      insert(record) {
        inserts += 1;
        if (inserts === 3) {
          throw new Error('second functional append failed');
        }
        auditRows.push(record);
        return record;
      }
    }
  });
  assert.throws(() => state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10, GOLES: 1 }, { operationId: 'OP-PARTIAL-MULTI' }), /AUDIT_PERSISTENCE_FAILED_AFTER_WRITE/);
  assert.throws(() => state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10, GOLES: 1 }, { operationId: 'OP-PARTIAL-MULTI' }), /AUDIT_RECONCILIATION_REQUIRED/);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('AUDIT_COMPLETE_REPLAY_TEST replays only after completed marker exists', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-COMPLETE-REPLAY' });
  const result = state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-COMPLETE-REPLAY' });
  assert.equal(result.idempotent, true);
  assert.equal(state.getAbsenceWriteCount(), 1);
});

test('OPERATION_CROSS_COMMAND_ID_CONFLICT_TEST rejects operation id reused across commands', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-CROSS' });
  assert.throws(() => state.command.approveConvocation('CON-001', 'coach', { operationId: 'OP-CROSS' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.getApprovalWriteCount(), 0);
});

test('OPERATION_NOOP_DIFFERENT_INTENT_CONFLICT_TEST rejects different no-op intent', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 0 }, { operationId: 'OP-NOOP-INTENT' });
  assert.throws(() => state.command.updateParticipation('PRT-001', { GOLES: 0 }, { operationId: 'OP-NOOP-INTENT' }), /OPERATION_ID_CONFLICT/);
  assert.equal(state.getParticipationWriteCount(), 1);
});

test('OPERATION_CREATE_PARTICIPATION_STABLE_ID_TEST stores generated identity in durable audit evidence', () => {
  const state = auditedCommandState({
    idGenerator: {
      operationId: () => 'OP-CREATE-STABLE',
      participationId: () => 'PRT-STABLE'
    }
  });
  state.command.createParticipation({ PARTIDO_ID: 'PAR-001', ALUMNO_ID: 'ALU-002', CONVOCATORIA_ID: 'CON-001' }, { operationId: 'OP-CREATE-STABLE' });
  const createdEvent = functionalEvents(state.auditRows).filter((row) => row.ACCION === 'CREACION')[0];
  assert.equal(createdEvent.ENTIDAD_ID, 'PRT-STABLE');
});

test('AUDIT_TWO_MANUAL_CHANGES_SAME_FIELD_TEST creates distinct events for distinct operations', () => {
  const state = auditedCommandState();
  state.command.setFinalSelection('CON-001', 'ALU-001', false, 'Decision', { operationId: 'OP-1' });
  state.command.setFinalSelection('CON-001', 'ALU-001', true, 'Decision', { operationId: 'OP-2' });
  assert.equal(functionalEvents(state.auditRows).length, 2);
});

test('AUDIT_TWO_PARTICIPATION_UPDATES_SAME_FIELD_TEST creates distinct participation events', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10 }, { operationId: 'OP-1' });
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 20 }, { operationId: 'OP-2' });
  assert.equal(functionalEvents(state.auditRows).length, 2);
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
  assert.equal(functionalEvents(state.auditRows).length, 2);
});

test('AUDIT_PARTICIPATION_MULTI_FIELD_TEST records one event per changed user field', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 10, GOLES: 1, AMARILLAS: 1 }, { operationId: 'OP-MULTI' });
  assert.deepEqual(functionalEvents(state.auditRows).map((row) => row.CAMPO).sort(), ['AMARILLAS', 'GOLES', 'MINUTOS_JUGADOS']);
});

test('AUDIT_PARTICIPATION_ONLY_CHANGED_FIELDS_TEST skips unchanged and modified timestamp fields', () => {
  const state = auditedCommandState();
  state.command.updateParticipation('PRT-001', { MINUTOS_JUGADOS: 0, MODIFICADO_EN: '2026-02-02' }, { operationId: 'OP-NOCHANGE' });
  assert.equal(functionalEvents(state.auditRows).length, 0);
});

test('AUDIT_ABSENCE_REASON_NOT_DUPLICATED_TEST stores safe absence motive only', () => {
  const state = auditedCommandState();
  state.command.resolveAbsence('AST-001', 'FJ', { operationId: 'OP-ABS', reason: 'Doctor note with private detail' });
  assert.equal(functionalEvents(state.auditRows)[0].MOTIVO, 'ABSENCE_JUSTIFIED');
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
