var SESSION_HEADERS = Object.freeze([
  'SESION_ID',
  'TIPO',
  'FECHA',
  'HORA_INICIO',
  'HORA_FIN',
  'COMPETENCIA',
  'PARTIDO_ID',
  'DESCRIPCION',
  'ESTADO',
  'CREADA_EN',
  'CERRADA_EN'
]);

var ATTENDANCE_HEADERS = Object.freeze([
  'ASISTENCIA_ID',
  'SESION_ID',
  'ALUMNO_ID',
  'ESTADO',
  'VALOR_APLICADO',
  'VALOR_MAXIMO_APLICADO',
  'REGISTRADO_EN',
  'LIMITE_JUSTIFICACION',
  'MODIFICADO_EN',
  'JUSTIFICACION',
  'AVISO_ENVIADO',
  'COMUNICACION_ID',
  'OBSERVACIONES'
]);

var SESSION_ENUMS = Object.freeze({
  TIPO: Object.freeze(['ENTRENAMIENTO', 'PARTIDO']),
  COMPETENCIA: Object.freeze(['GENERAL', 'A', 'B']),
  ESTADO: Object.freeze(['ABIERTA', 'CERRADA'])
});

var ATTENDANCE_STATUS = Object.freeze({
  INITIAL: Object.freeze(['A', 'R', 'F']),
  FINALIZED: Object.freeze(['A', 'R', 'FJ', 'FI', 'LES']),
  ALL: Object.freeze(['A', 'R', 'F', 'FJ', 'FI', 'LES'])
});

if (typeof globalThis !== 'undefined') {
  globalThis.ATTENDANCE_HEADERS = ATTENDANCE_HEADERS;
  globalThis.ATTENDANCE_STATUS = ATTENDANCE_STATUS;
  globalThis.SESSION_ENUMS = SESSION_ENUMS;
  globalThis.SESSION_HEADERS = SESSION_HEADERS;
}

if (typeof module !== 'undefined') {
  module.exports = {
    ATTENDANCE_HEADERS,
    ATTENDANCE_STATUS,
    SESSION_ENUMS,
    SESSION_HEADERS
  };
}
