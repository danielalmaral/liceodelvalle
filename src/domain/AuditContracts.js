var AUDIT_HEADERS = Object.freeze([
  'EVENTO_ID',
  'FECHA_HORA',
  'USUARIO',
  'ENTIDAD',
  'ENTIDAD_ID',
  'ACCION',
  'CAMPO',
  'VALOR_ANTERIOR',
  'VALOR_NUEVO',
  'MOTIVO'
]);

if (typeof globalThis !== 'undefined') {
  globalThis.AUDIT_HEADERS = AUDIT_HEADERS;
}

if (typeof module !== 'undefined') {
  module.exports = { AUDIT_HEADERS };
}
