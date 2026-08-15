var MATCH_HEADERS = Object.freeze([
  'PARTIDO_ID',
  'COMPETENCIA',
  'JORNADA',
  'RIVAL',
  'FECHA',
  'HORA_CITACION',
  'HORA_PARTIDO',
  'SEDE',
  'LOCAL_VISITANTE',
  'DURACION_MINUTOS',
  'UNIFORME',
  'INDICACIONES',
  'ESTADO',
  'GOLES_FAVOR',
  'GOLES_CONTRA',
  'OBSERVACIONES'
]);

var MATCH_ENUMS = Object.freeze({
  COMPETENCIA: Object.freeze(['A', 'B']),
  LOCAL_VISITANTE: Object.freeze(['LOCAL', 'VISITANTE']),
  ESTADO: Object.freeze(['PROGRAMADO', 'JUGADO', 'CANCELADO'])
});

if (typeof globalThis !== 'undefined') {
  globalThis.MATCH_ENUMS = MATCH_ENUMS;
  globalThis.MATCH_HEADERS = MATCH_HEADERS;
}

if (typeof module !== 'undefined') {
  module.exports = {
    MATCH_ENUMS,
    MATCH_HEADERS
  };
}
