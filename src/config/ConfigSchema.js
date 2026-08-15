const CONFIG_TYPES = Object.freeze({
  INTEGER: 'INTEGER',
  DECIMAL: 'DECIMAL',
  BOOLEAN: 'BOOLEAN',
  STRING: 'STRING',
  ENUM: 'ENUM'
});

const CONFIG_GROUPS = Object.freeze({
  GENERAL: 'GENERAL',
  ASISTENCIA: 'ASISTENCIA',
  CONVOCATORIA: 'CONVOCATORIA',
  ROTACION: 'ROTACION',
  POSICIONES: 'POSICIONES',
  RENDIMIENTO: 'RENDIMIENTO',
  DISCIPLINA: 'DISCIPLINA',
  COMUNICACION: 'COMUNICACION'
});

const CONFIG_SCHEMA = Object.freeze([
  { key: 'TEMPORADA', group: CONFIG_GROUPS.GENERAL, type: CONFIG_TYPES.STRING, required: true },
  { key: 'CONVOCADOS_A', group: CONFIG_GROUPS.CONVOCATORIA, type: CONFIG_TYPES.INTEGER, required: true, unit: 'jugadores', validate: 'positiveInteger' },
  { key: 'CONVOCADOS_B', group: CONFIG_GROUPS.CONVOCATORIA, type: CONFIG_TYPES.INTEGER, required: true, unit: 'jugadores', validate: 'positiveInteger' },
  { key: 'CONFIRMACION_PADRES', group: CONFIG_GROUPS.CONVOCATORIA, type: CONFIG_TYPES.BOOLEAN, required: true },
  { key: 'ASISTENCIA_VALOR', group: CONFIG_GROUPS.ASISTENCIA, type: CONFIG_TYPES.DECIMAL, required: true, unit: 'puntos', validate: 'nonNegativeDecimal' },
  { key: 'RETARDO_VALOR', group: CONFIG_GROUPS.ASISTENCIA, type: CONFIG_TYPES.DECIMAL, required: true, unit: 'puntos', validate: 'nonNegativeDecimal' },
  { key: 'FALTA_INJUSTIFICADA_VALOR', group: CONFIG_GROUPS.ASISTENCIA, type: CONFIG_TYPES.DECIMAL, required: true, unit: 'puntos', validate: 'nonNegativeDecimal' },
  { key: 'FALTA_JUSTIFICADA_VALOR', group: CONFIG_GROUPS.ASISTENCIA, type: CONFIG_TYPES.DECIMAL, required: true, unit: 'puntos', validate: 'nonNegativeDecimal' },
  { key: 'LESION_VALOR', group: CONFIG_GROUPS.ASISTENCIA, type: CONFIG_TYPES.DECIMAL, required: true, unit: 'puntos', validate: 'nonNegativeDecimal' },
  { key: 'HORAS_JUSTIFICACION', group: CONFIG_GROUPS.ASISTENCIA, type: CONFIG_TYPES.INTEGER, required: true, unit: 'horas', validate: 'positiveInteger' },
  { key: 'ROTACION_OBLIGATORIA', group: CONFIG_GROUPS.ROTACION, type: CONFIG_TYPES.BOOLEAN, required: true },
  { key: 'MAX_SIN_CONVOCATORIA', group: CONFIG_GROUPS.ROTACION, type: CONFIG_TYPES.INTEGER, required: true, unit: 'partidos', validate: 'positiveInteger' },
  { key: 'MIN_PORTEROS', group: CONFIG_GROUPS.POSICIONES, type: CONFIG_TYPES.INTEGER, required: true, unit: 'jugadores', validate: 'positiveInteger' },
  { key: 'MIN_DEFENSAS', group: CONFIG_GROUPS.POSICIONES, type: CONFIG_TYPES.INTEGER, required: true, unit: 'jugadores', validate: 'positiveInteger' },
  { key: 'MIN_MEDIOS', group: CONFIG_GROUPS.POSICIONES, type: CONFIG_TYPES.INTEGER, required: true, unit: 'jugadores', validate: 'positiveInteger' },
  { key: 'MIN_DELANTEROS', group: CONFIG_GROUPS.POSICIONES, type: CONFIG_TYPES.INTEGER, required: true, unit: 'jugadores', validate: 'positiveInteger' },
  { key: 'ESCALA_CALIFICACION_MIN', group: CONFIG_GROUPS.RENDIMIENTO, type: CONFIG_TYPES.INTEGER, required: true, unit: 'estrellas', validate: 'positiveInteger' },
  { key: 'ESCALA_CALIFICACION_MAX', group: CONFIG_GROUPS.RENDIMIENTO, type: CONFIG_TYPES.INTEGER, required: true, unit: 'estrellas', validate: 'positiveInteger' },
  { key: 'CALIFICACION_DECIMALES', group: CONFIG_GROUPS.RENDIMIENTO, type: CONFIG_TYPES.BOOLEAN, required: true },
  { key: 'CONTROL_MINUTOS_A', group: CONFIG_GROUPS.RENDIMIENTO, type: CONFIG_TYPES.BOOLEAN, required: true },
  { key: 'CONTROL_MINUTOS_B', group: CONFIG_GROUPS.RENDIMIENTO, type: CONFIG_TYPES.BOOLEAN, required: true },
  { key: 'ALERTA_SUPLENCIAS_CONSECUTIVAS', group: CONFIG_GROUPS.RENDIMIENTO, type: CONFIG_TYPES.INTEGER, required: true, unit: 'partidos', validate: 'positiveInteger' },
  { key: 'ROJA_BLOQUEA_CONVOCATORIA', group: CONFIG_GROUPS.DISCIPLINA, type: CONFIG_TYPES.BOOLEAN, required: true },
  { key: 'AVISO_AUSENCIA_EMAIL', group: CONFIG_GROUPS.COMUNICACION, type: CONFIG_TYPES.BOOLEAN, required: true },
  { key: 'CONVOCATORIA_EMAIL', group: CONFIG_GROUPS.COMUNICACION, type: CONFIG_TYPES.BOOLEAN, required: true }
]);

function getConfigSchemaByKey(key) {
  return CONFIG_SCHEMA.find((entry) => entry.key === key);
}

function getRequiredConfigKeys() {
  return CONFIG_SCHEMA.filter((entry) => entry.required).map((entry) => entry.key);
}

if (typeof globalThis !== 'undefined') {
  globalThis.CONFIG_GROUPS = CONFIG_GROUPS;
  globalThis.CONFIG_SCHEMA = CONFIG_SCHEMA;
  globalThis.CONFIG_TYPES = CONFIG_TYPES;
}

if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG_GROUPS,
    CONFIG_SCHEMA,
    CONFIG_TYPES,
    getConfigSchemaByKey,
    getRequiredConfigKeys
  };
}
