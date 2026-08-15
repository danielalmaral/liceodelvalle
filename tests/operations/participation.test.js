const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');
const { createArrayRepository } = require('../../src/repositories/ArrayRepository');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
require('../../src/config/ConfigSchema');
require('../../src/domain/AttendanceContracts');
require('../../src/domain/MatchContracts');
require('../../src/domain/ConvocationContracts');
require('../../src/domain/ParticipationContracts');
const { createConfigService } = require('../../src/config/ConfigService');
const { createAttendanceFoundationService } = require('../../src/services/AttendanceFoundationService');
const { createMatchService } = require('../../src/services/MatchService');
const { createParticipationService } = require('../../src/services/ParticipationService');
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
    ESTADO: 'JUGADO',
    GOLES_FAVOR: 1,
    GOLES_CONTRA: 0,
    OBSERVACIONES: '',
    ...overrides
  };
}

function session(overrides = {}) {
  return {
    SESION_ID: 'SES-001',
    TIPO: 'PARTIDO',
    FECHA: '2026-02-01',
    HORA_INICIO: '10:00',
    HORA_FIN: '11:00',
    COMPETENCIA: 'A',
    PARTIDO_ID: 'PAR-001',
    DESCRIPCION: '',
    ESTADO: 'ABIERTA',
    CREADA_EN: '',
    CERRADA_EN: '',
    ...overrides
  };
}

function student(overrides = {}) {
  return {
    ALUMNO_ID: 'ALU-001',
    NOMBRES: 'Alumno',
    APELLIDOS: 'Ficticio',
    ACTIVO: true,
    COMPETENCIA_BASE: 'A',
    NIVEL: 'A1',
    POSICION_PRINCIPAL: 'DEF',
    POSICION_SECUNDARIA: '',
    FECHA_ALTA: '2026-01-01',
    FECHA_BAJA: '',
    ESTADO_DEPORTIVO: 'OK',
    OBSERVACIONES: '',
    ...overrides
  };
}

function convocation(overrides = {}) {
  return {
    CONVOCATORIA_ID: 'CON-001',
    PARTIDO_ID: 'PAR-001',
    COMPETENCIA: 'A',
    ESTADO: 'APROBADA',
    ...overrides
  };
}

function detail(overrides = {}) {
  return {
    DETALLE_ID: 'DET-001',
    CONVOCATORIA_ID: 'CON-001',
    ALUMNO_ID: 'ALU-001',
    COMPETENCIA_SNAPSHOT: 'A',
    ELEGIBILITY_STATUS: 'ELIGIBLE',
    POSICION_PRINCIPAL_SNAPSHOT: 'DEF',
    POSICION_SECUNDARIA_SNAPSHOT: '',
    POSICION_ASIGNADA: 'DEF',
    SELECCIONADO_FINAL: true,
    ...overrides
  };
}

function attendance(overrides = {}) {
  return {
    ASISTENCIA_ID: 'AST-001',
    SESION_ID: 'SES-001',
    ALUMNO_ID: 'ALU-001',
    ESTADO: 'A',
    VALOR_APLICADO: 1,
    VALOR_MAXIMO_APLICADO: 1,
    REGISTRADO_EN: '2026-02-01',
    LIMITE_JUSTIFICACION: '',
    MODIFICADO_EN: '',
    JUSTIFICACION: '',
    AVISO_ENVIADO: false,
    COMUNICACION_ID: '',
    OBSERVACIONES: '',
    ...overrides
  };
}

function service(options = {}) {
  const matches = options.matches || [match()];
  const sessions = options.sessions || [session()];
  const students = options.students || [student()];
  const attendances = options.attendances || [attendance()];
  const cfg = options.configService || config(options.config || {});
  const matchRepository = createArrayRepository(matches);
  const attendanceService = createAttendanceFoundationService({
    attendanceRepository: createArrayRepository(attendances),
    configService: cfg,
    matchRepository,
    sessionRepository: createArrayRepository(sessions),
    studentRepository: createArrayRepository(students),
    utils
  });

  return createParticipationService({
    attendanceService,
    clock: { now: () => new Date('2026-02-01T12:00:00Z') },
    configService: cfg,
    convocationRepository: createArrayRepository(options.convocations || [convocation()]),
    detailRepository: createArrayRepository(options.details || [detail()]),
    idGenerator: { participationId: () => options.nextId || 'PRT-001' },
    matchService: createMatchService({ matchRepository, utils }),
    participationRepository: createArrayRepository(options.participations || []),
    studentRepository: createArrayRepository(students),
    utils
  });
}

function input(overrides = {}) {
  return {
    PARTIDO_ID: 'PAR-001',
    ALUMNO_ID: 'ALU-001',
    CONVOCATORIA_ID: 'CON-001',
    ASISTIO: true,
    ASISTENCIA_ESTADO: 'A',
    CONDICION_INICIAL: 'TITULAR',
    MINUTOS_JUGADOS: 45,
    GOLES: 0,
    AMARILLAS: 0,
    ROJAS: 0,
    CALIFICACION: 5,
    OBSERVACIONES: '',
    ...overrides
  };
}

test('PARTICIPATION_SCHEMA_TEST creates participation records', () => {
  assert.equal(service().createParticipation(input()).PARTICIPACION_ID, 'PRT-001');
});

test('PARTICIPATION_ID_UNIQUENESS_TEST rejects duplicate ids', () => {
  assert.throws(() => service({ participations: [{ ...input(), PARTICIPACION_ID: 'PRT-001' }] }).createParticipation(input()), /PARTICIPATION_DUPLICATE_ID/);
});

test('PARTICIPATION_MATCH_FK_TEST rejects missing match', () => {
  assert.throws(() => service({ matches: [] }).createParticipation(input()), /PARTICIPATION_MATCH_FK/);
});

test('PARTICIPATION_CONVOCATION_FK_TEST rejects missing convocation', () => {
  assert.throws(() => service({ convocations: [] }).createParticipation(input()), /PARTICIPATION_CONVOCATION_FK/);
});

test('PARTICIPATION_SELECTED_PLAYER_TEST rejects unselected player', () => {
  assert.throws(() => service({ details: [detail({ SELECCIONADO_FINAL: false })] }).createParticipation(input()), /PARTICIPATION_PLAYER_NOT_SELECTED/);
});

test('PARTICIPATION_DUPLICATE_MATCH_PLAYER_TEST rejects duplicate match player', () => {
  assert.throws(() => service({ participations: [{ ...input(), PARTICIPACION_ID: 'PRT-OLD' }] }).createParticipation(input({ PARTICIPACION_ID: 'PRT-NEW' })), /PARTICIPATION_DUPLICATE_MATCH_PLAYER/);
});

test('PARTICIPATION_ATTENDANCE_BOOLEAN_TEST normalizes ASISTIO strictly', () => {
  assert.equal(service().createParticipation(input({ ASISTIO: 'SI' })).ASISTIO, true);
  assert.throws(() => service().createParticipation(input({ ASISTIO: 'yes' })), /PARTICIPATION_BOOLEAN_INVALID/);
});

test('PARTICIPATION_START_CONDITION_TEST requires condition when attended', () => {
  assert.throws(() => service().createParticipation(input({ CONDICION_INICIAL: '' })), /INVALID_ENUM: CONDICION_INICIAL/);
});

test('PARTICIPATION_MINUTES_RANGE_TEST validates duration bounds', () => {
  assert.throws(() => service().createParticipation(input({ MINUTOS_JUGADOS: 61 })), /PARTICIPATION_MINUTES_RANGE/);
});

test('PARTICIPATION_ABSENT_ZERO_MINUTES_TEST requires zero minutes for absence', () => {
  assert.throws(() => service({ attendances: [attendance({ ESTADO: 'F' })] }).createParticipation(input({ ASISTIO: false, ASISTENCIA_ESTADO: 'F', CONDICION_INICIAL: '', MINUTOS_JUGADOS: 1, CALIFICACION: '' })), /PARTICIPATION_ABSENT_MINUTES/);
});

test('PARTICIPATION_GOALS_TEST rejects negative goals', () => {
  assert.throws(() => service().createParticipation(input({ GOLES: -1 })), /PARTICIPATION_INTEGER_INVALID/);
});

test('PARTICIPATION_CARDS_TEST rejects negative cards', () => {
  assert.throws(() => service().createParticipation(input({ AMARILLAS: -1 })), /PARTICIPATION_INTEGER_INVALID/);
});

test('PARTICIPATION_RED_MAX_TEST rejects more than one red card', () => {
  assert.throws(() => service().createParticipation(input({ ROJAS: 2 })), /PARTICIPATION_RED_MAX/);
});

test('PARTICIPATION_RATING_CONFIG_TEST validates configured rating scale', () => {
  assert.throws(() => service().createParticipation(input({ CALIFICACION: 6 })), /PARTICIPATION_RATING_INVALID/);
});

test('PARTICIPATION_RATING_DECIMALS_TEST honors decimal config', () => {
  assert.throws(() => service({ config: { CALIFICACION_DECIMALES: 'NO' } }).createParticipation(input({ CALIFICACION: 4.5 })), /PARTICIPATION_RATING_DECIMALS_INVALID/);
  assert.equal(service({ config: { CALIFICACION_DECIMALES: 'SI' } }).createParticipation(input({ CALIFICACION: 4.5 })).CALIFICACION, 4.5);
});

test('PARTICIPATION_CANCELLED_MATCH_TEST rejects cancelled matches', () => {
  assert.throws(() => service({ matches: [match({ ESTADO: 'CANCELADO', GOLES_FAVOR: '', GOLES_CONTRA: '' })] }).createParticipation(input()), /PARTICIPATION_MATCH_CANCELLED/);
});

test('PARTICIPATION_READINESS_TEST detects missing and complete participation', () => {
  assert.equal(service().validateMatchParticipationReadiness('PAR-001').ready, false);
  const svc = service();
  svc.createParticipation(input());
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').ready, true);
});

test('RED_CARD_REVIEW_REQUIRED_TEST surfaces red review alert', () => {
  const svc = service();
  svc.createParticipation(input({ ROJAS: 1 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts[0].code, 'RED_CARD_REVIEW_REQUIRED');
});

test('LOW_PARTICIPATION_STREAK_CONFIG_TEST uses configured zero-minute streak', () => {
  const svc = service({
    config: { ALERTA_SUPLENCIAS_CONSECUTIVAS: '2' },
    matches: [match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' }), match()],
    convocations: [convocation({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD' }), convocation()],
    details: [detail({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD' }), detail()],
    participations: [{ ...input({ MINUTOS_JUGADOS: 0 }), PARTICIPACION_ID: 'PRT-OLD', PARTIDO_ID: 'PAR-OLD', CONVOCATORIA_ID: 'CON-OLD' }]
  });
  svc.createParticipation(input({ MINUTOS_JUGADOS: 0 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts.some((alert) => alert.code === 'LOW_PARTICIPATION_STREAK'), true);
});

test('PARTICIPATION_ATTENDANCE_PRESENCE_TEST accepts present attendance states as attended', () => {
  assert.equal(service({ attendances: [attendance({ ESTADO: 'R' })] }).createParticipation(input({ ASISTENCIA_ESTADO: 'R', ASISTIO: true })).ASISTIO, true);
});

test('PARTICIPATION_PRESENT_WITH_ABSENCE_STATE_TEST rejects present flag with absence state', () => {
  assert.throws(() => service({ attendances: [attendance({ ESTADO: 'F' })] }).createParticipation(input({ ASISTENCIA_ESTADO: 'F', ASISTIO: true })), /PARTICIPATION_ATTENDANCE_PRESENCE_MISMATCH/);
});

test('PARTICIPATION_ABSENT_GOALS_ZERO_TEST rejects stats for absent player', () => {
  assert.throws(() => service({ attendances: [attendance({ ESTADO: 'F' })] }).createParticipation(input({ ASISTENCIA_ESTADO: 'F', ASISTIO: false, CONDICION_INICIAL: '', MINUTOS_JUGADOS: 0, GOLES: 1, CALIFICACION: '' })), /PARTICIPATION_ABSENT_STATS/);
});

test('PARTICIPATION_ABSENT_CARDS_ZERO_TEST rejects cards for absent player', () => {
  assert.throws(() => service({ attendances: [attendance({ ESTADO: 'F' })] }).createParticipation(input({ ASISTENCIA_ESTADO: 'F', ASISTIO: false, CONDICION_INICIAL: '', MINUTOS_JUGADOS: 0, AMARILLAS: 1, CALIFICACION: '' })), /PARTICIPATION_ABSENT_STATS/);
});

test('PARTICIPATION_ABSENT_STATS_ZERO_TEST rejects any non-zero absent stat', () => {
  assert.throws(() => service({ attendances: [attendance({ ESTADO: 'F' })] }).createParticipation(input({ ASISTENCIA_ESTADO: 'F', ASISTIO: false, CONDICION_INICIAL: '', MINUTOS_JUGADOS: 0, ROJAS: 1, CALIFICACION: '' })), /PARTICIPATION_ABSENT_STATS/);
});

test('PARTICIPATION_PROGRAMMED_NOT_READY_TEST prevents closing stats before match played', () => {
  const svc = service({ matches: [match({ ESTADO: 'PROGRAMADO', GOLES_FAVOR: '', GOLES_CONTRA: '' })] });
  assert.deepEqual(svc.validateMatchParticipationReadiness('PAR-001').errors, ['MATCH_NOT_PLAYED']);
});

test('LOW_PARTICIPATION_CONSECUTIVE_STREAK_TEST counts consecutive selected zero-minute participations', () => {
  const svc = service({
    config: { ALERTA_SUPLENCIAS_CONSECUTIVAS: '2' },
    matches: [match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' }), match()],
    convocations: [convocation({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD' }), convocation()],
    details: [detail({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD' }), detail()],
    participations: [{ ...input({ MINUTOS_JUGADOS: 0 }), PARTICIPACION_ID: 'PRT-OLD', PARTIDO_ID: 'PAR-OLD', CONVOCATORIA_ID: 'CON-OLD' }]
  });
  svc.createParticipation(input({ MINUTOS_JUGADOS: 0 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts.some((alert) => alert.code === 'LOW_PARTICIPATION_STREAK'), true);
});

test('LOW_PARTICIPATION_NON_CONSECUTIVE_ZERO_TEST ignores non selected gaps', () => {
  const svc = service({
    config: { ALERTA_SUPLENCIAS_CONSECUTIVAS: '2' },
    matches: [match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' }), match({ PARTIDO_ID: 'PAR-MID', FECHA: '2026-01-15' }), match()],
    convocations: [convocation({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD' }), convocation({ CONVOCATORIA_ID: 'CON-MID', PARTIDO_ID: 'PAR-MID' }), convocation()],
    details: [detail({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD' }), detail({ DETALLE_ID: 'DET-MID', CONVOCATORIA_ID: 'CON-MID' }), detail()],
    participations: [
      { ...input({ MINUTOS_JUGADOS: 0 }), PARTICIPACION_ID: 'PRT-OLD', PARTIDO_ID: 'PAR-OLD', CONVOCATORIA_ID: 'CON-OLD' },
      { ...input({ MINUTOS_JUGADOS: 10 }), PARTICIPACION_ID: 'PRT-MID', PARTIDO_ID: 'PAR-MID', CONVOCATORIA_ID: 'CON-MID' }
    ]
  });
  svc.createParticipation(input({ MINUTOS_JUGADOS: 0 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts.some((alert) => alert.code === 'LOW_PARTICIPATION_STREAK'), false);
});

test('LOW_PARTICIPATION_POSITIVE_MINUTES_RESETS_TEST stops on positive minutes', () => {
  const svc = service({
    config: { ALERTA_SUPLENCIAS_CONSECUTIVAS: '2' },
    matches: [match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' }), match()],
    convocations: [convocation({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD' }), convocation()],
    details: [detail({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD' }), detail()],
    participations: [{ ...input({ MINUTOS_JUGADOS: 15 }), PARTICIPACION_ID: 'PRT-OLD', PARTIDO_ID: 'PAR-OLD', CONVOCATORIA_ID: 'CON-OLD' }]
  });
  svc.createParticipation(input({ MINUTOS_JUGADOS: 0 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts.some((alert) => alert.code === 'LOW_PARTICIPATION_STREAK'), false);
});

test('LOW_PARTICIPATION_COMPETITION_SCOPED_TEST ignores other competition history', () => {
  const svc = service({
    config: { ALERTA_SUPLENCIAS_CONSECUTIVAS: '2' },
    matches: [match({ PARTIDO_ID: 'PAR-B', COMPETENCIA: 'B', FECHA: '2026-01-01' }), match()],
    convocations: [convocation({ CONVOCATORIA_ID: 'CON-B', PARTIDO_ID: 'PAR-B', COMPETENCIA: 'B' }), convocation()],
    details: [detail({ DETALLE_ID: 'DET-B', CONVOCATORIA_ID: 'CON-B', COMPETENCIA_SNAPSHOT: 'B' }), detail()],
    participations: [{ ...input({ MINUTOS_JUGADOS: 0 }), PARTICIPACION_ID: 'PRT-B', PARTIDO_ID: 'PAR-B', CONVOCATORIA_ID: 'CON-B' }]
  });
  svc.createParticipation(input({ MINUTOS_JUGADOS: 0 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts.some((alert) => alert.code === 'LOW_PARTICIPATION_STREAK'), false);
});

test('LOW_PARTICIPATION_REPOSITORY_REORDER_TEST uses match chronology', () => {
  const svc = service({
    config: { ALERTA_SUPLENCIAS_CONSECUTIVAS: '2' },
    matches: [match(), match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01' })],
    convocations: [convocation(), convocation({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD' })],
    details: [detail(), detail({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD' })],
    participations: [{ ...input({ MINUTOS_JUGADOS: 0 }), PARTICIPACION_ID: 'PRT-OLD', PARTIDO_ID: 'PAR-OLD', CONVOCATORIA_ID: 'CON-OLD' }]
  });
  svc.createParticipation(input({ MINUTOS_JUGADOS: 0 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts.some((alert) => alert.code === 'LOW_PARTICIPATION_STREAK'), true);
});

test('LOW_PARTICIPATION_CANCELLED_MATCH_IGNORED_TEST ignores cancelled matches', () => {
  const svc = service({
    config: { ALERTA_SUPLENCIAS_CONSECUTIVAS: '2' },
    matches: [match({ PARTIDO_ID: 'PAR-OLD', FECHA: '2026-01-01', ESTADO: 'CANCELADO', GOLES_FAVOR: '', GOLES_CONTRA: '' }), match()],
    convocations: [convocation({ CONVOCATORIA_ID: 'CON-OLD', PARTIDO_ID: 'PAR-OLD' }), convocation()],
    details: [detail({ DETALLE_ID: 'DET-OLD', CONVOCATORIA_ID: 'CON-OLD' }), detail()],
    participations: [{ ...input({ MINUTOS_JUGADOS: 0 }), PARTICIPACION_ID: 'PRT-OLD', PARTIDO_ID: 'PAR-OLD', CONVOCATORIA_ID: 'CON-OLD' }]
  });
  svc.createParticipation(input({ MINUTOS_JUGADOS: 0 }));
  assert.equal(svc.validateMatchParticipationReadiness('PAR-001').alerts.some((alert) => alert.code === 'LOW_PARTICIPATION_STREAK'), false);
});
