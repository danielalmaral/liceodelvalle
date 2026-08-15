function createMasterDataService(dependencies) {
  var utils = dependencies.utils;
  var studentRepository = dependencies.studentRepository;
  var tutorRepository = dependencies.tutorRepository;

  function copyRecord(record) {
    var next = {};
    Object.keys(record || {}).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function normalizeGrade(value) {
    if (typeof value === 'string') {
      return utils.requireText(value, 'GRADO');
    }

    if (value === undefined || value === null) {
      throw utils.createDomainError('REQUIRED_FIELD', 'GRADO');
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    throw utils.createDomainError('INVALID_GRADE', 'GRADO');
  }

  function normalizeStudent(row) {
    var alta = utils.parseDateValue(row.FECHA_ALTA, 'FECHA_ALTA');
    var baja = utils.parseOptionalDateValue(row.FECHA_BAJA, 'FECHA_BAJA');

    if (baja && baja.getTime() < alta.getTime()) {
      throw utils.createDomainError('INVALID_DATE_RANGE', row.ALUMNO_ID);
    }

    return {
      alumnoId: utils.requireText(row.ALUMNO_ID, 'ALUMNO_ID'),
      active: utils.normalizeStrictBoolean(row.ACTIVO, 'ACTIVO'),
      nombre: utils.requireText(row.NOMBRE, 'NOMBRE'),
      apellidos: utils.requireText(row.APELLIDOS, 'APELLIDOS'),
      grado: normalizeGrade(row.GRADO),
      grupo: utils.optionalText(row.GRUPO),
      competenciaBase: utils.assertOneOf(row.COMPETENCIA_BASE, STUDENT_ENUMS.COMPETENCIA_BASE, 'COMPETENCIA_BASE'),
      nivel: utils.assertOneOf(row.NIVEL, STUDENT_ENUMS.NIVEL, 'NIVEL'),
      posicionPrincipal: utils.assertOneOf(row.POSICION_PRINCIPAL, STUDENT_ENUMS.POSICION, 'POSICION_PRINCIPAL'),
      posicionSecundaria: row.POSICION_SECUNDARIA ? utils.assertOneOf(row.POSICION_SECUNDARIA, STUDENT_ENUMS.POSICION, 'POSICION_SECUNDARIA') : '',
      fechaAlta: alta,
      fechaBaja: baja,
      estadoDeportivo: utils.assertOneOf(row.ESTADO_DEPORTIVO, STUDENT_ENUMS.ESTADO_DEPORTIVO, 'ESTADO_DEPORTIVO'),
      observaciones: utils.optionalText(row.OBSERVACIONES)
    };
  }

  function normalizeTutor(row, studentIds) {
    var alumnoId = utils.requireText(row.ALUMNO_ID, 'ALUMNO_ID');
    var recibeAusencias = utils.normalizeStrictBoolean(row.RECIBE_AUSENCIAS, 'RECIBE_AUSENCIAS');
    var recibeConvocatorias = utils.normalizeStrictBoolean(row.RECIBE_CONVOCATORIAS, 'RECIBE_CONVOCATORIAS');
    var email = utils.normalizeEmail(row.EMAIL);

    if (!studentIds[alumnoId]) {
      throw utils.createDomainError('TUTOR_STUDENT_FK', alumnoId);
    }

    if (email && !utils.isValidEmail(email)) {
      throw utils.createDomainError('TUTOR_EMAIL_INVALID', row.TUTOR_ID);
    }

    if ((recibeAusencias || recibeConvocatorias) && !utils.isValidEmail(email)) {
      throw utils.createDomainError('TUTOR_EMAIL_REQUIRED', row.TUTOR_ID);
    }

    return {
      tutorId: utils.requireText(row.TUTOR_ID, 'TUTOR_ID'),
      alumnoId: alumnoId,
      nombreTutor: utils.requireText(row.NOMBRE_TUTOR, 'NOMBRE_TUTOR'),
      parentesco: utils.requireText(row.PARENTESCO, 'PARENTESCO'),
      email: email,
      telefono: utils.optionalText(row.TELEFONO),
      principal: utils.normalizeStrictBoolean(row.PRINCIPAL, 'PRINCIPAL'),
      recibeAusencias: recibeAusencias,
      recibeConvocatorias: recibeConvocatorias,
      active: utils.normalizeStrictBoolean(row.ACTIVO, 'ACTIVO')
    };
  }

  function getStudents() {
    var students = studentRepository.getAll().map(normalizeStudent);
    utils.assertUnique(students, function(student) { return student.alumnoId; }, 'STUDENT_DUPLICATE_ID');
    return students;
  }

  function getTutors() {
    var students = getStudents();
    var studentIds = {};
    students.forEach(function(student) {
      studentIds[student.alumnoId] = true;
    });

    var tutors = tutorRepository.getAll().map(function(row) {
      return normalizeTutor(row, studentIds);
    });
    var principalByStudent = {};

    utils.assertUnique(tutors, function(tutor) { return tutor.tutorId; }, 'TUTOR_DUPLICATE_ID');

    tutors.forEach(function(tutor) {
      if (tutor.active && tutor.principal) {
        if (principalByStudent[tutor.alumnoId]) {
          throw utils.createDomainError('TUTOR_DUPLICATE_PRINCIPAL', tutor.alumnoId);
        }

        principalByStudent[tutor.alumnoId] = true;
      }
    });

    return tutors;
  }

  function getCommunicationReadiness() {
    var students = getStudents().filter(function(student) { return student.active; });
    var tutors = getTutors();

    return students.map(function(student) {
      var studentTutors = tutors.filter(function(tutor) {
        return tutor.alumnoId === student.alumnoId && tutor.active && utils.isValidEmail(tutor.email);
      });

      return {
        alumnoId: student.alumnoId,
        ausenciasReady: studentTutors.some(function(tutor) { return tutor.recibeAusencias; }),
        convocatoriasReady: studentTutors.some(function(tutor) { return tutor.recibeConvocatorias; })
      };
    });
  }

  function updateStudentSportsState(studentId, state, actor, reasonCode) {
    if (!studentRepository || typeof studentRepository.updateById !== 'function') {
      throw utils.createDomainError('REPOSITORY_WRITE_REQUIRED', 'ALUMNOS');
    }

    var id = utils.requireText(studentId, 'ALUMNO_ID');
    var current = studentRepository.getAll().filter(function(student) {
      return student.ALUMNO_ID === id;
    })[0] || null;
    var next;
    var allowedReasons = ['COACH_DECISION', 'INJURY', 'DISCIPLINE', 'CLEARED'];

    if (!current) {
      throw utils.createDomainError('STUDENT_NOT_FOUND', id);
    }

    if (allowedReasons.indexOf(reasonCode) === -1) {
      throw utils.createDomainError('STUDENT_SPORTS_REASON_INVALID', 'reasonCode');
    }

    next = copyRecord(current);
    next.ESTADO_DEPORTIVO = utils.assertOneOf(state, STUDENT_ENUMS.ESTADO_DEPORTIVO, 'ESTADO_DEPORTIVO');
    return studentRepository.updateById('ALUMNO_ID', id, next);
  }

  return {
    getCommunicationReadiness: getCommunicationReadiness,
    getStudents: getStudents,
    getTutors: getTutors,
    updateStudentSportsState: updateStudentSportsState
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createMasterDataService };
}
