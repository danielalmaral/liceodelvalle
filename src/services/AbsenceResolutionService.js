function createAbsenceResolutionService(dependencies) {
  var utils = dependencies.utils;
  var attendanceRepository = dependencies.attendanceRepository;
  var tutorRepository = dependencies.tutorRepository;
  var configService = dependencies.configService;
  var clock = dependencies.clock || { now: function() { return new Date(); } };

  function snapshotFor(status) {
    var keyByStatus = {
      FJ: 'FALTA_JUSTIFICADA_VALOR',
      LES: 'LESION_VALOR',
      FI: 'FALTA_INJUSTIFICADA_VALOR'
    };

    return {
      value: configService.getDecimal(keyByStatus[status]),
      max: configService.getDecimal('ASISTENCIA_VALOR')
    };
  }

  function findAttendance(attendanceId) {
    var record = attendanceRepository.getAll().filter(function(candidate) {
      return candidate.ASISTENCIA_ID === attendanceId;
    })[0];

    if (!record) {
      throw utils.createDomainError('ATTENDANCE_NOT_FOUND', attendanceId);
    }

    return record;
  }

  function resolveAbsence(attendanceId, finalStatus, options) {
    var now = options && options.now ? options.now : clock.now();
    var reason = options && options.reason ? options.reason : '';
    var record = findAttendance(attendanceId);

    if (record.ESTADO !== 'F') {
      throw utils.createDomainError('ABSENCE_INVALID_TRANSITION', record.ESTADO);
    }

    if (finalStatus !== 'FJ' && finalStatus !== 'LES' && finalStatus !== 'FI') {
      throw utils.createDomainError('ABSENCE_INVALID_TRANSITION', finalStatus);
    }

    validateAttendanceConfigPolicy(configService, utils);

    if ((finalStatus === 'FJ' || finalStatus === 'LES') && record.LIMITE_JUSTIFICACION && now.getTime() > new Date(record.LIMITE_JUSTIFICACION).getTime()) {
      finalStatus = 'FI';
    }

    var snapshot = snapshotFor(finalStatus);
    var previous = record.ESTADO;
    var nextRecord = {};

    Object.keys(record).forEach(function(key) {
      nextRecord[key] = record[key];
    });

    nextRecord.ESTADO = finalStatus;
    nextRecord.VALOR_APLICADO = snapshot.value;
    nextRecord.VALOR_MAXIMO_APLICADO = snapshot.max;
    nextRecord.MODIFICADO_EN = now;
    nextRecord.JUSTIFICACION = reason;

    validateAttendanceSnapshot(nextRecord, utils);
    attendanceRepository.updateById('ASISTENCIA_ID', attendanceId, nextRecord);

    return {
      attendance: nextRecord,
      audit: {
        attendanceId: attendanceId,
        previousStatus: previous,
        newStatus: finalStatus,
        changedAt: now,
        reason: reason,
        AUDIT_PERSISTENCE: 'DEFERRED'
      }
    };
  }

  function resolveExpiredAbsences(now) {
    var resolved = [];
    var current = now || clock.now();

    attendanceRepository.getAll().forEach(function(record) {
      if (record.ESTADO === 'F' && record.LIMITE_JUSTIFICACION && current.getTime() > new Date(record.LIMITE_JUSTIFICACION).getTime()) {
        resolved.push(resolveAbsence(record.ASISTENCIA_ID, 'FI', { now: current, reason: 'EXPIRED' }));
      }
    });

    return resolved;
  }

  function prepareAbsenceNotificationIntents(attendanceId) {
    var attendance = findAttendance(attendanceId);
    var tutors = tutorRepository.getAll().filter(function(tutor) {
      var active = utils.normalizeStrictBoolean(tutor.ACTIVO, 'ACTIVO');
      var receives = utils.normalizeStrictBoolean(tutor.RECIBE_AUSENCIAS, 'RECIBE_AUSENCIAS');
      var email = utils.normalizeEmail(tutor.EMAIL);

      return tutor.ALUMNO_ID === attendance.ALUMNO_ID && active && receives && utils.isValidEmail(email);
    });

    if (tutors.length === 0) {
      return {
        intents: [],
        warnings: ['NO_ELIGIBLE_RECIPIENT']
      };
    }

    return {
      intents: tutors.map(function(tutor) {
        return {
          TYPE: 'AUSENCIA',
          ATTENDANCE_ID: attendance.ASISTENCIA_ID,
          SESSION_ID: attendance.SESION_ID,
          STUDENT_ID: attendance.ALUMNO_ID,
          TUTOR_ID: tutor.TUTOR_ID,
          RECIPIENT_EMAIL: utils.normalizeEmail(tutor.EMAIL),
          OCCURRED_AT: attendance.REGISTRADO_EN
        };
      }),
      warnings: []
    };
  }

  return {
    prepareAbsenceNotificationIntents: prepareAbsenceNotificationIntents,
    resolveAbsence: resolveAbsence,
    resolveExpiredAbsences: resolveExpiredAbsences
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAbsenceResolutionService };
}
