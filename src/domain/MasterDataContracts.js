var STUDENT_HEADERS = Object.freeze([
  'ALUMNO_ID',
  'ACTIVO',
  'NOMBRE',
  'APELLIDOS',
  'GRADO',
  'GRUPO',
  'COMPETENCIA_BASE',
  'NIVEL',
  'POSICION_PRINCIPAL',
  'POSICION_SECUNDARIA',
  'FECHA_ALTA',
  'FECHA_BAJA',
  'ESTADO_DEPORTIVO',
  'OBSERVACIONES'
]);

var TUTOR_HEADERS = Object.freeze([
  'TUTOR_ID',
  'ALUMNO_ID',
  'NOMBRE_TUTOR',
  'PARENTESCO',
  'EMAIL',
  'TELEFONO',
  'PRINCIPAL',
  'RECIBE_AUSENCIAS',
  'RECIBE_CONVOCATORIAS',
  'ACTIVO'
]);

var STUDENT_ENUMS = Object.freeze({
  COMPETENCIA_BASE: Object.freeze(['A', 'B']),
  NIVEL: Object.freeze(['A1', 'A2', 'B1', 'B2']),
  POSICION: Object.freeze(['PO', 'DEF', 'MED', 'DEL']),
  ESTADO_DEPORTIVO: Object.freeze(['ACTIVO', 'LESIONADO', 'SUSPENDIDO'])
});

if (typeof globalThis !== 'undefined') {
  globalThis.STUDENT_HEADERS = STUDENT_HEADERS;
  globalThis.TUTOR_HEADERS = TUTOR_HEADERS;
  globalThis.STUDENT_ENUMS = STUDENT_ENUMS;
}

if (typeof module !== 'undefined') {
  module.exports = {
    STUDENT_ENUMS,
    STUDENT_HEADERS,
    TUTOR_HEADERS
  };
}
