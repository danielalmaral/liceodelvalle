var PARTICIPATION_HEADERS = Object.freeze([
  'PARTICIPACION_ID',
  'PARTIDO_ID',
  'ALUMNO_ID',
  'CONVOCATORIA_ID',
  'ASISTIO',
  'ASISTENCIA_ESTADO',
  'CONDICION_INICIAL',
  'MINUTOS_JUGADOS',
  'GOLES',
  'AMARILLAS',
  'ROJAS',
  'CALIFICACION',
  'OBSERVACIONES',
  'REGISTRADO_EN',
  'MODIFICADO_EN'
]);

var PARTICIPATION_ENUMS = Object.freeze({
  CONDICION_INICIAL: Object.freeze(['TITULAR', 'SUPLENTE']),
  ASISTENCIA_ESTADO: Object.freeze(['A', 'R', 'F', 'FJ', 'FI', 'LES'])
});

if (typeof globalThis !== 'undefined') {
  globalThis.PARTICIPATION_ENUMS = PARTICIPATION_ENUMS;
  globalThis.PARTICIPATION_HEADERS = PARTICIPATION_HEADERS;
}

if (typeof module !== 'undefined') {
  module.exports = {
    PARTICIPATION_ENUMS,
    PARTICIPATION_HEADERS
  };
}
