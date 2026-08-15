function createAttendanceFoundationService(dependencies) {
  var utils = dependencies.utils;
  var sessionRepository = dependencies.sessionRepository;
  var attendanceRepository = dependencies.attendanceRepository;
  var studentRepository = dependencies.studentRepository;
  var matchRepository = dependencies.matchRepository;
  var configService = dependencies.configService;
  var idGenerator = dependencies.idGenerator || {};
  var clock = dependencies.clock || { now: function() { return new Date(); } };

  function ensureWritableRepository() {
    if (!attendanceRepository || typeof attendanceRepository.insert !== 'function') {
      throw utils.createDomainError('REPOSITORY_WRITE_REQUIRED', 'ASISTENCIAS');
    }
  }

  function normalizeSession(row) {
    var fecha = utils.parseDateValue(row.FECHA, 'FECHA');
    var start = row.HORA_INICIO ? new Date('1970-01-01T' + row.HORA_INICIO) : null;
    var end = row.HORA_FIN ? new Date('1970-01-01T' + row.HORA_FIN) : null;

    if (start && Number.isNaN(start.getTime())) {
      throw utils.createDomainError('INVALID_TIME', 'HORA_INICIO');
    }

    if (end && Number.isNaN(end.getTime())) {
      throw utils.createDomainError('INVALID_TIME', 'HORA_FIN');
    }

    if (start && end && end.getTime() < start.getTime()) {
      throw utils.createDomainError('SESSION_TIME_RANGE', row.SESION_ID);
    }

    return {
      sesionId: utils.requireText(row.SESION_ID, 'SESION_ID'),
      tipo: utils.assertOneOf(row.TIPO, SESSION_ENUMS.TIPO, 'TIPO'),
      fecha: fecha,
      horaInicio: row.HORA_INICIO || '',
      horaFin: row.HORA_FIN || '',
      competencia: utils.assertOneOf(row.COMPETENCIA, SESSION_ENUMS.COMPETENCIA, 'COMPETENCIA'),
      partidoId: utils.optionalText(row.PARTIDO_ID),
      descripcion: utils.optionalText(row.DESCRIPCION),
      estado: utils.assertOneOf(row.ESTADO, SESSION_ENUMS.ESTADO, 'ESTADO'),
      creadaEn: row.CREADA_EN || '',
      cerradaEn: row.CERRADA_EN || ''
    };
  }

  function getSessions() {
    var sessions = sessionRepository.getAll().map(normalizeSession);
    var matchById = {};

    if (matchRepository) {
      matchRepository.getAll().forEach(function(match) {
        matchById[match.PARTIDO_ID] = match;
      });
    }

    utils.assertUnique(sessions, function(session) { return session.sesionId; }, 'SESSION_DUPLICATE_ID');

    sessions.forEach(function(session) {
      if (session.tipo === 'ENTRENAMIENTO' && session.partidoId) {
        throw utils.createDomainError('SESSION_TRAINING_MATCH_NOT_EMPTY', session.sesionId);
      }

      if (session.tipo === 'PARTIDO') {
        if (!session.partidoId) {
          throw utils.createDomainError('SESSION_MATCH_REQUIRED', session.sesionId);
        }

        if (session.competencia === 'GENERAL') {
          throw utils.createDomainError('SESSION_MATCH_COMPETITION_INVALID', session.sesionId);
        }

        if (!matchRepository || typeof matchRepository.getAll !== 'function') {
          throw utils.createDomainError('REPOSITORY_READ_REQUIRED', 'PARTIDOS');
        }

        var match = matchById[session.partidoId];

        if (!match) {
          throw utils.createDomainError('SESSION_MATCH_FK', session.partidoId);
        }

        if (match.COMPETENCIA !== session.competencia) {
          throw utils.createDomainError('SESSION_MATCH_COMPETITION_ALIGNMENT', session.sesionId);
        }
      }
    });

    return sessions;
  }

  function studentIdSet() {
    var ids = {};
    studentRepository.getAll().forEach(function(row) {
      ids[row.ALUMNO_ID] = true;
    });
    return ids;
  }

  function normalizeAttendance(row) {
    return {
      asistenciaId: utils.requireText(row.ASISTENCIA_ID, 'ASISTENCIA_ID'),
      sesionId: utils.requireText(row.SESION_ID, 'SESION_ID'),
      alumnoId: utils.requireText(row.ALUMNO_ID, 'ALUMNO_ID'),
      estado: utils.assertOneOf(row.ESTADO, ATTENDANCE_STATUS.ALL, 'ESTADO'),
      valorAplicado: row.VALOR_APLICADO === '' || row.VALOR_APLICADO === undefined ? null : Number(row.VALOR_APLICADO),
      valorMaximoAplicado: row.VALOR_MAXIMO_APLICADO === '' || row.VALOR_MAXIMO_APLICADO === undefined ? null : Number(row.VALOR_MAXIMO_APLICADO),
      registradoEn: row.REGISTRADO_EN ? utils.parseDateValue(row.REGISTRADO_EN, 'REGISTRADO_EN') : null,
      limiteJustificacion: row.LIMITE_JUSTIFICACION ? utils.parseDateValue(row.LIMITE_JUSTIFICACION, 'LIMITE_JUSTIFICACION') : null,
      modificadoEn: row.MODIFICADO_EN || '',
      justificacion: utils.optionalText(row.JUSTIFICACION),
      avisoEnviado: row.AVISO_ENVIADO ? utils.normalizeStrictBoolean(row.AVISO_ENVIADO, 'AVISO_ENVIADO') : false,
      comunicacionId: utils.optionalText(row.COMUNICACION_ID),
      observaciones: utils.optionalText(row.OBSERVACIONES),
      raw: row
    };
  }

  function getAttendances() {
    var sessions = {};
    var students = studentIdSet();
    var pairSeen = {};
    var attendances = attendanceRepository.getAll().map(normalizeAttendance);

    getSessions().forEach(function(session) {
      sessions[session.sesionId] = true;
    });
    utils.assertUnique(attendances, function(attendance) { return attendance.asistenciaId; }, 'ATTENDANCE_DUPLICATE_ID');

    attendances.forEach(function(attendance) {
      var pair = attendance.sesionId + '|' + attendance.alumnoId;

      if (!sessions[attendance.sesionId]) {
        throw utils.createDomainError('ATTENDANCE_SESSION_FK', attendance.sesionId);
      }

      if (!students[attendance.alumnoId]) {
        throw utils.createDomainError('ATTENDANCE_STUDENT_FK', attendance.alumnoId);
      }

      if (pairSeen[pair]) {
        throw utils.createDomainError('ATTENDANCE_DUPLICATE_SESSION_STUDENT', pair);
      }

      pairSeen[pair] = true;
    });

    return attendances;
  }

  function createAttendance(input) {
    ensureWritableRepository();
    var sessions = getSessions();
    var session = sessions.filter(function(candidate) { return candidate.sesionId === input.sesionId; })[0];
    var estado = utils.assertOneOf(input.estado, ATTENDANCE_STATUS.INITIAL, 'ESTADO');
    var registradoEn = input.registradoEn || clock.now();
    var value = null;
    var max = null;
    var limiteJustificacion = null;
    var students = studentIdSet();
    var existingAttendances = attendanceRepository.getAll();
    var asistenciaId = input.asistenciaId || (idGenerator.attendanceId ? idGenerator.attendanceId() : '');

    if (!session) {
      throw utils.createDomainError('ATTENDANCE_SESSION_FK', input.sesionId);
    }

    if (!students[input.alumnoId]) {
      throw utils.createDomainError('ATTENDANCE_STUDENT_FK', input.alumnoId);
    }

    if (session.estado === 'CERRADA') {
      throw utils.createDomainError('SESSION_CLOSED', input.sesionId);
    }

    if (!asistenciaId || String(asistenciaId).trim() === '') {
      throw utils.createDomainError('ATTENDANCE_ID_REQUIRED', 'ASISTENCIA_ID');
    }

    existingAttendances.forEach(function(record) {
      if (record.SESION_ID === input.sesionId && record.ALUMNO_ID === input.alumnoId) {
        throw utils.createDomainError('ATTENDANCE_DUPLICATE_SESSION_STUDENT', input.sesionId + '|' + input.alumnoId);
      }

      if (record.ASISTENCIA_ID === asistenciaId) {
        throw utils.createDomainError('ATTENDANCE_DUPLICATE_ID', asistenciaId);
      }
    });

    validateAttendanceConfigPolicy(configService, utils);

    if (estado === 'A') {
      value = configService.getDecimal('ASISTENCIA_VALOR');
      max = value;
    } else if (estado === 'R') {
      value = configService.getDecimal('RETARDO_VALOR');
      max = configService.getDecimal('ASISTENCIA_VALOR');
    } else if (estado === 'F') {
      limiteJustificacion = new Date(registradoEn.getTime() + configService.getInteger('HORAS_JUSTIFICACION') * 60 * 60 * 1000);
    }

    var record = {
      ASISTENCIA_ID: asistenciaId,
      SESION_ID: input.sesionId,
      ALUMNO_ID: input.alumnoId,
      ESTADO: estado,
      VALOR_APLICADO: value,
      VALOR_MAXIMO_APLICADO: max,
      REGISTRADO_EN: registradoEn,
      LIMITE_JUSTIFICACION: limiteJustificacion,
      MODIFICADO_EN: registradoEn,
      JUSTIFICACION: '',
      AVISO_ENVIADO: false,
      COMUNICACION_ID: '',
      OBSERVACIONES: ''
    };

    validateAttendanceSnapshot(record, utils);

    return attendanceRepository.insert(record);
  }

  return {
    createAttendance: createAttendance,
    getAttendances: getAttendances,
    getSessions: getSessions
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAttendanceFoundationService };
}
