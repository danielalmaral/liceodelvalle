var COMMUNICATION_HEADERS = Object.freeze([
  'COMUNICACION_ID',
  'TIPO',
  'ALUMNO_ID',
  'TUTOR_ID',
  'REFERENCIA_ID',
  'DESTINATARIO',
  'ASUNTO',
  'CUERPO',
  'CREADO_EN',
  'ENVIADO_EN',
  'ESTADO',
  'ERROR',
  'INTENTOS'
]);

var COMMUNICATION_ENUMS = Object.freeze({
  TIPO: Object.freeze(['AUSENCIA', 'CONVOCATORIA']),
  ESTADO: Object.freeze(['PENDIENTE', 'ENVIADO', 'ERROR'])
});

if (typeof globalThis !== 'undefined') {
  globalThis.COMMUNICATION_ENUMS = COMMUNICATION_ENUMS;
  globalThis.COMMUNICATION_HEADERS = COMMUNICATION_HEADERS;
}

if (typeof module !== 'undefined') {
  module.exports = {
    COMMUNICATION_ENUMS,
    COMMUNICATION_HEADERS
  };
}
