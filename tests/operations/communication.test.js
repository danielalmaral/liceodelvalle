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
