const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
require('../../src/domain/CommunicationContracts');
require('../../src/domain/MatchContracts');
const { createConfigService } = require('../../src/config/ConfigService');
const { createMatchService } = require('../../src/services/MatchService');
const { createCommunicationService } = require('../../src/services/CommunicationService');
const { createAuditService } = require('../../src/services/AuditService');
const { createOperationalCommandService } = require('../../src/services/OperationalCommandService');
const { createAppsScriptMailAdapter } = require('../../src/adapters/AppsScriptMailAdapter');
const { createTriggerHandlers } = require('../../src/triggers/TriggerHandlers');
const { completeConfigRows } = require('../config/config-fixtures');

function config(overrides = {}) {
  return createConfigService(createConfigRepository(completeConfigRows(overrides)));
}

function match(overrides = {}) {
  return {
    PARTIDO_ID: 'PAR-001',
    COMPETENCIA: 'A',
    JORNADA: 'J1',
    RIVAL: 'Rival Ficticio',
    FECHA: '2026-02-01',
    HORA_CITACION: '09:00',
    HORA_PARTIDO: '10:00',
    SEDE: 'Cancha Ficticia',
    LOCAL_VISITANTE: 'LOCAL',
    DURACION_MINUTOS: '60',
    UNIFORME: 'Azul',
    INDICACIONES: 'Llegar puntuales',
    ESTADO: 'PROGRAMADO',
    GOLES_FAVOR: '',
    GOLES_CONTRA: '',
    OBSERVACIONES: '',
    ...overrides
  };
}

function attendance(overrides = {}) {
  return {
    ASISTENCIA_ID: 'AST-001',
    SESION_ID: 'SES-001',
    ALUMNO_ID: 'ALU-001',
    ESTADO: 'F',
    AVISO_ENVIADO: false,
    COMUNICACION_ID: '',
    ...overrides
  };
}

function tutor(overrides = {}) {
  return {
    TUTOR_ID: 'TUT-001',
    ALUMNO_ID: 'ALU-001',
    NOMBRE_TUTOR: 'Tutor',
    EMAIL: 'family@example.invalid',
    ACTIVO: true,
    RECIBE_AUSENCIAS: true,
    RECIBE_CONVOCATORIAS: true,
    ...overrides
  };
}

function student(overrides = {}) {
  return { ALUMNO_ID: 'ALU-001', NOMBRE: 'Alumno', APELLIDOS: 'Ficticio', ...overrides };
}

function convocation(overrides = {}) {
  return { CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001', COMPETENCIA: 'A', ESTADO: 'APROBADA', ...overrides };
}

function detail(overrides = {}) {
  return { DETALLE_ID: 'DET-001', CONVOCATORIA_ID: 'CON-001', ALUMNO_ID: 'ALU-001', SELECCIONADO_FINAL: true, ...overrides };
}

function communication(overrides = {}) {
  return {
    COMUNICACION_ID: 'COM-001',
    TIPO: 'AUSENCIA',
    ALUMNO_ID: 'ALU-001',
    TUTOR_ID: 'TUT-001',
    REFERENCIA_ID: 'AST-001',
    DESTINATARIO: 'family@example.invalid',
    ASUNTO: 'Aviso',
    CUERPO: 'Mensaje',
    CREADO_EN: '',
    ENVIADO_EN: '',
    ESTADO: 'PENDIENTE',
    ERROR: '',
    INTENTOS: 0,
    ...overrides
  };
}

function service(options = {}) {
  const communicationRows = options.communications || [];
  const matchRepository = createArrayRepository(options.matches || [match()]);
  const attendanceRepository = createArrayRepository(options.attendances || [attendance()]);
  return {
    attendanceRepository,
    communicationRows,
    service: createCommunicationService({
      attendanceRepository,
      clock: { now: () => new Date('2026-02-01T12:00:00Z') },
      communicationRepository: createArrayRepository(communicationRows),
      configService: config(options.config || {}),
      convocationRepository: createArrayRepository(options.convocations || [convocation()]),
      detailRepository: createArrayRepository(options.details || [detail()]),
      idGenerator: { communicationId: (type, ref, studentId, tutorId) => `COM-${type}-${ref}-${studentId}-${tutorId}` },
      mailAdapter: options.mailAdapter || { send() {} },
      matchService: createMatchService({ matchRepository, utils }),
      studentRepository: createArrayRepository(options.students || [student()]),
      tutorRepository: createArrayRepository(options.tutors || [tutor()]),
      utils
    })
  };
}

test('COMMUNICATION_SCHEMA_TEST validates communication shape', () => {
  assert.equal(service({ communications: [communication()] }).service.getCommunications()[0].ESTADO, 'PENDIENTE');
});

test('COMMUNICATION_ID_UNIQUENESS_TEST rejects duplicate ids', () => {
  assert.throws(() => service({ communications: [communication(), communication()] }).service.getCommunications(), /COMMUNICATION_DUPLICATE_ID/);
});

test('COMMUNICATION_TYPE_TEST rejects invalid type', () => {
  assert.throws(() => service({ communications: [communication({ TIPO: 'OTRO' })] }).service.getCommunications(), /INVALID_ENUM: TIPO/);
});

test('COMMUNICATION_STATE_TEST rejects invalid state', () => {
  assert.throws(() => service({ communications: [communication({ ESTADO: 'LISTO' })] }).service.getCommunications(), /INVALID_ENUM: ESTADO/);
});

test('COMMUNICATION_ABSENCE_GENERATION_TEST creates absence messages for eligible tutor', () => {
  assert.equal(service().service.generateAbsenceCommunications('AST-001').created.length, 1);
});

test('COMMUNICATION_ABSENCE_NEUTRAL_TEXT_TEST does not label absence as unjustified', () => {
  const body = service().service.generateAbsenceCommunications('AST-001').created[0].CUERPO;
  assert.equal(body.includes('injustificada'), false);
});

test('COMMUNICATION_CONVOCATION_APPROVED_ONLY_TEST only sends approved convocations', () => {
  assert.equal(service({ convocations: [convocation({ ESTADO: 'PROPUESTA' })] }).service.generateConvocationCommunications('CON-001').created.length, 0);
});

test('COMMUNICATION_CONVOCATION_SELECTED_ONLY_TEST creates only selected student communications', () => {
  assert.equal(service({ details: [detail({ SELECCIONADO_FINAL: false })] }).service.generateConvocationCommunications('CON-001').created.length, 0);
});

test('COMMUNICATION_CONVOCATION_CONTENT_TEST includes match operation details', () => {
  const body = service().service.generateConvocationCommunications('CON-001').created[0].CUERPO;
  assert.equal(body.includes('Rival Ficticio') && body.includes('Cancha Ficticia') && body.includes('Azul'), true);
});

test('COMMUNICATION_NO_PARENT_CONFIRMATION_TEST does not request parent confirmation', () => {
  const body = service().service.generateConvocationCommunications('CON-001').created[0].CUERPO.toLowerCase();
  assert.equal(body.includes('confirm'), false);
});

test('COMMUNICATION_IDEMPOTENCY_TEST does not duplicate logical message', () => {
  const state = service();
  state.service.generateAbsenceCommunications('AST-001');
  state.service.generateAbsenceCommunications('AST-001');
  assert.equal(state.service.getCommunications().length, 1);
});

test('COMMUNICATION_CONFIG_DISABLED_TEST skips generation when config disables type', () => {
  assert.equal(service({ config: { AVISO_AUSENCIA_EMAIL: 'NO' } }).service.generateAbsenceCommunications('AST-001').created.length, 0);
  assert.equal(service({ config: { CONVOCATORIA_EMAIL: 'NO' } }).service.generateConvocationCommunications('CON-001').created.length, 0);
});

test('COMMUNICATION_SEND_SUCCESS_TEST sends pending message', () => {
  const state = service({ communications: [communication()] });
  const result = state.service.sendPendingCommunications()[0];
  assert.equal(result.communication.ESTADO, 'ENVIADO');
});

test('COMMUNICATION_SEND_ERROR_TEST stores sanitized error state', () => {
  const state = service({ communications: [communication()], mailAdapter: { send() { throw new Error('SMTP failed for family@example.invalid'); } } });
  const result = state.service.sendPendingCommunications()[0];
  assert.equal(result.communication.ESTADO, 'ERROR');
  assert.equal(result.communication.ERROR.includes('family@example.invalid'), false);
});

test('COMMUNICATION_RETRY_TEST retries explicit failed message', () => {
  const state = service({ communications: [communication({ ESTADO: 'ERROR', ERROR: 'fail', INTENTOS: 1 })] });
  assert.equal(state.service.retryCommunication('COM-001').communication.ESTADO, 'ENVIADO');
});

test('COMMUNICATION_ERROR_SANITIZATION_TEST removes sensitive recipient from errors', () => {
  const state = service({ communications: [communication()], mailAdapter: { send() { throw new Error('bad recipient family@example.invalid'); } } });
  assert.equal(state.service.sendPendingCommunications()[0].communication.ERROR.includes('@example.invalid'), false);
});

test('COMMUNICATION_MULTI_TUTOR_TEST creates one message per eligible tutor', () => {
  const result = service({ tutors: [tutor(), tutor({ TUTOR_ID: 'TUT-002', EMAIL: 'second@example.invalid' })] }).service.generateAbsenceCommunications('AST-001');
  assert.equal(result.created.length, 2);
});

test('COMMUNICATION_REFERENCE_CARDINALITY_TEST keeps attendance pointer as summary only', () => {
  const state = service({ tutors: [tutor(), tutor({ TUTOR_ID: 'TUT-002', EMAIL: 'second@example.invalid' })] });
  state.service.generateAbsenceCommunications('AST-001');
  state.service.sendPendingCommunications();
  assert.equal(state.service.getCommunications().length, 2);
  assert.equal(state.attendanceRepository.getAll()[0].AVISO_ENVIADO, true);
});

test('COMMUNICATION_POINTER_FAILURE_NO_DUPLICATE_RETRY_TEST does not retry delivered mail after pointer failure', () => {
  let sent = 0;
  const communicationRows = [communication()];
  const failingAttendanceRepository = {
    getAll() { return [attendance()]; },
    updateById() { throw new Error('pointer failed'); }
  };
  const svc = createCommunicationService({
    attendanceRepository: failingAttendanceRepository,
    clock: { now: () => new Date('2026-02-01T12:00:00Z') },
    communicationRepository: createArrayRepository(communicationRows),
    configService: config(),
    convocationRepository: createArrayRepository([convocation()]),
    detailRepository: createArrayRepository([detail()]),
    mailAdapter: { send() { sent += 1; } },
    matchService: createMatchService({ matchRepository: createArrayRepository([match()]), utils }),
    studentRepository: createArrayRepository([student()]),
    tutorRepository: createArrayRepository([tutor()]),
    utils
  });
  const result = svc.sendPendingCommunications()[0];
  assert.equal(result.warning, 'COMMUNICATION_SUMMARY_POINTER_FAILED');
  assert.equal(communicationRows[0].ESTADO, 'ENVIADO');
  assert.throws(() => svc.retryCommunication('COM-001'), /COMMUNICATION_RETRY_INVALID_STATE/);
  assert.equal(sent, 1);
});

test('COMMUNICATION_SEND_CONFIG_DISABLED_TEST skips pending send when config disabled', () => {
  let sent = 0;
  const state = service({ communications: [communication()], config: { AVISO_AUSENCIA_EMAIL: 'NO' }, mailAdapter: { send() { sent += 1; } } });
  const result = state.service.sendPendingCommunications()[0];
  assert.equal(result.skipped, true);
  assert.equal(state.service.getCommunications()[0].ESTADO, 'PENDIENTE');
  assert.equal(sent, 0);
});

test('COMMUNICATION_ABSENCE_SOURCE_STATE_TEST only generates absence notices for pending F', () => {
  assert.throws(() => service({ attendances: [attendance({ ESTADO: 'A' })] }).service.generateAbsenceCommunications('AST-001'), /COMMUNICATION_ABSENCE_SOURCE_INVALID/);
});

test('COMMUNICATION_TUTOR_BOOLEAN_FAIL_CLOSED_TEST rejects invalid tutor flags', () => {
  assert.throws(() => service({ tutors: [tutor({ ACTIVO: 'yes' })] }).service.generateAbsenceCommunications('AST-001'), /COMMUNICATION_TUTOR_BOOLEAN_INVALID/);
});

test('APPS_SCRIPT_MAIL_ADAPTER_LAZY_TEST does not call provider during construction', () => {
  let sent = 0;
  const adapter = createAppsScriptMailAdapter({ sendEmail() { sent += 1; } });
  assert.equal(sent, 0);
  adapter.send({ to: 'family@example.invalid', subject: 'Test', body: 'Body' });
  assert.equal(sent, 1);
});

test('APPS_SCRIPT_MAIL_ADAPTER_PROVIDER_REQUIRED_TEST fails only when send is attempted', () => {
  const adapter = createAppsScriptMailAdapter(null);
  assert.throws(() => adapter.send({ to: 'family@example.invalid', subject: 'Test', body: 'Body' }), /MAIL_PROVIDER_REQUIRED/);
});

test('COMMUNICATION_STATE_PERSISTENCE_FAILURE_NO_RESEND_TEST blocks auto resend after delivered state cannot persist', () => {
  let sent = 0;
  const rows = [communication()];
  const communicationRepository = {
    getAll() { return rows; },
    updateById(idField, id, nextRecord) {
      if (nextRecord.ESTADO === 'ENVIADO') {
        throw new Error('persist failed');
      }
      rows[0] = nextRecord;
      return nextRecord;
    }
  };
  const svc = createCommunicationService({
    attendanceRepository: createArrayRepository([attendance()]),
    clock: { now: () => new Date('2026-02-01T12:00:00Z') },
    communicationRepository,
    configService: config(),
    convocationRepository: createArrayRepository([convocation()]),
    detailRepository: createArrayRepository([detail()]),
    mailAdapter: { send() { sent += 1; } },
    matchService: createMatchService({ matchRepository: createArrayRepository([match()]), utils }),
    studentRepository: createArrayRepository([student()]),
    tutorRepository: createArrayRepository([tutor()]),
    utils
  });
  const result = svc.sendPendingCommunications()[0];
  assert.equal(result.ok, false);
  assert.equal(result.uncertain, true);
  assert.equal(result.code, 'COMMUNICATION_DELIVERY_STATE_UNCERTAIN');
  assert.equal(rows[0].ERROR, 'DELIVERY_ATTEMPT_IN_PROGRESS');
  assert.equal(svc.sendPendingCommunications().length, 0);
  assert.equal(sent, 1);
});

test('COMMUNICATION_PRE_SEND_WRITE_FAILURE_NO_MAIL_TEST does not call provider if attempt marker fails', () => {
  let sent = 0;
  const communicationRepository = {
    getAll() { return [communication()]; },
    updateById() { throw new Error('pre write failed'); }
  };
  const svc = createCommunicationService({
    attendanceRepository: createArrayRepository([attendance()]),
    clock: { now: () => new Date('2026-02-01T12:00:00Z') },
    communicationRepository,
    configService: config(),
    convocationRepository: createArrayRepository([convocation()]),
    detailRepository: createArrayRepository([detail()]),
    mailAdapter: { send() { sent += 1; } },
    matchService: createMatchService({ matchRepository: createArrayRepository([match()]), utils }),
    studentRepository: createArrayRepository([student()]),
    tutorRepository: createArrayRepository([tutor()]),
    utils
  });
  assert.throws(() => svc.sendPendingCommunications(), /pre write failed/);
  assert.equal(sent, 0);
});

test('COMMUNICATION_UNCERTAIN_RETRY_BLOCKED_TEST rejects retry of uncertain delivery marker', () => {
  const state = service({ communications: [communication({ ESTADO: 'ERROR', ERROR: 'DELIVERY_ATTEMPT_IN_PROGRESS', INTENTOS: 1 })] });
  assert.throws(() => state.service.retryCommunication('COM-001'), /COMMUNICATION_DELIVERY_STATE_UNCERTAIN/);
});

test('COMMUNICATION_CONFIG_DISABLED_RETRY_STATE_TEST skips retry without mutating error row', () => {
  const state = service({ communications: [communication({ ESTADO: 'ERROR', ERROR: 'provider failed', INTENTOS: 1 })], config: { AVISO_AUSENCIA_EMAIL: 'NO' } });
  const result = state.service.retryCommunication('COM-001');
  assert.equal(result.skipped, true);
  assert.equal(state.communicationRows[0].ESTADO, 'ERROR');
  assert.equal(state.communicationRows[0].ERROR, 'provider failed');
});

test('COMMUNICATION_DUPLICATE_LOGICAL_KEY_TEST rejects duplicate logical communication keys', () => {
  assert.throws(() => service({ communications: [communication(), communication({ COMUNICACION_ID: 'COM-002' })] }).service.getCommunications(), /COMMUNICATION_DUPLICATE_LOGICAL_KEY/);
});

test('COMMUNICATION_RECIPIENT_VALIDATION_TEST rejects invalid recipient', () => {
  assert.throws(() => service({ communications: [communication({ DESTINATARIO: 'not-email' })] }).service.getCommunications(), /COMMUNICATION_RECIPIENT_INVALID/);
});

test('COMMUNICATION_ATTEMPTS_INTEGRITY_TEST rejects invalid attempts', () => {
  assert.throws(() => service({ communications: [communication({ INTENTOS: -1 })] }).service.getCommunications(), /COMMUNICATION_ATTEMPTS_INVALID/);
});

function functionalEvents(rows) {
  return rows.filter((row) => row.ENTIDAD !== 'OPERACION');
}

function commandWithCommunicationRepository(communicationRepository, mailAdapter) {
  const auditRows = [];
  const communicationService = createCommunicationService({
    attendanceRepository: createArrayRepository([attendance()]),
    clock: { now: () => new Date('2026-02-01T12:00:00Z') },
    communicationRepository,
    configService: config(),
    convocationRepository: createArrayRepository([convocation()]),
    detailRepository: createArrayRepository([detail()]),
    mailAdapter,
    matchService: createMatchService({ matchRepository: createArrayRepository([match()]), utils }),
    studentRepository: createArrayRepository([student()]),
    tutorRepository: createArrayRepository([tutor()]),
    utils
  });
  return {
    auditRows,
    command: createOperationalCommandService({
      idGenerator: { operationId: () => 'OP-COM-BATCH' },
      repositories: { communicationRepository },
      services: {
        auditService: createAuditService({ auditRepository: createArrayRepository(auditRows), utils }),
        communicationService
      },
      utils
    }),
    communicationService
  };
}

test('AUDIT_COMMUNICATION_UNCERTAIN_STATE_TEST records uncertain state transition', () => {
  let sent = 0;
  const rows = [communication()];
  const communicationRepository = {
    getAll() { return rows; },
    updateById(idField, id, nextRecord) {
      if (nextRecord.ESTADO === 'ENVIADO') {
        throw new Error('persist failed');
      }
      rows[0] = nextRecord;
      return nextRecord;
    }
  };
  const state = commandWithCommunicationRepository(communicationRepository, { send() { sent += 1; } });
  const result = state.command.sendPendingCommunications({ operationId: 'OP-UNCERTAIN' });
  const event = functionalEvents(state.auditRows)[0];

  assert.equal(result[0].uncertain, true);
  assert.equal(rows[0].ESTADO, 'ERROR');
  assert.equal(rows[0].ERROR, 'DELIVERY_ATTEMPT_IN_PROGRESS');
  assert.equal(event.VALOR_ANTERIOR, 'PENDIENTE');
  assert.equal(event.VALOR_NUEVO, 'ERROR');
  assert.equal(state.communicationService.sendPendingCommunications().length, 0);
  assert.equal(sent, 1);
});

test('COMMUNICATION_BATCH_PARTIAL_UNCERTAINTY_AUDIT_TEST keeps all persisted transitions auditable', () => {
  const rows = [
    communication({ COMUNICACION_ID: 'COM-001' }),
    communication({ COMUNICACION_ID: 'COM-002', TUTOR_ID: 'TUT-002', DESTINATARIO: 'second@example.invalid' })
  ];
  const communicationRepository = {
    getAll() { return rows; },
    updateById(idField, id, nextRecord) {
      const index = rows.findIndex((row) => row.COMUNICACION_ID === id);
      if (id === 'COM-002' && nextRecord.ESTADO === 'ENVIADO') {
        throw new Error('persist failed');
      }
      rows[index] = nextRecord;
      return nextRecord;
    }
  };
  const state = commandWithCommunicationRepository(communicationRepository, { send() {} });
  const result = state.command.sendPendingCommunications({ operationId: 'OP-PARTIAL' });
  const events = functionalEvents(state.auditRows).sort((a, b) => a.ENTIDAD_ID.localeCompare(b.ENTIDAD_ID));

  assert.equal(result.length, 2);
  assert.equal(rows[0].ESTADO, 'ENVIADO');
  assert.equal(rows[1].ESTADO, 'ERROR');
  assert.equal(rows[1].ERROR, 'DELIVERY_ATTEMPT_IN_PROGRESS');
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.VALOR_NUEVO), ['ENVIADO', 'ERROR']);
  assert.equal(state.communicationService.sendPendingCommunications().length, 0);
});

test('COMMUNICATION_UNCERTAIN_TRIGGER_SUMMARY_TEST counts uncertainty as failed without PII', () => {
  const handlers = createTriggerHandlers({
    commands: {
      sendPendingCommunications() {
        return [
          { ok: true, communication: { COMUNICACION_ID: 'COM-001' } },
          { ok: false, uncertain: true, code: 'COMMUNICATION_DELIVERY_STATE_UNCERTAIN', communication: { COMUNICACION_ID: 'COM-002' } }
        ];
      }
    }
  });
  const summary = handlers.sendPendingCommunications();
  assert.deepEqual(summary, { processed: 2, succeeded: 1, failed: 1 });
  assert.deepEqual(Object.keys(summary).sort(), ['failed', 'processed', 'succeeded']);
});
