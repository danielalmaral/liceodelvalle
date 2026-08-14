const { CONFIG_SCHEMA } = require('../../src/config/ConfigSchema');

function row(key, value, overrides = {}) {
  const schema = CONFIG_SCHEMA.find((entry) => entry.key === key);

  if (!schema) {
    throw new Error(`Unknown fixture key: ${key}`);
  }

  return {
    CONFIG_ID: `CFG_${key}`,
    GRUPO: schema.group,
    CLAVE: key,
    VALOR: value,
    TIPO: schema.type,
    UNIDAD: schema.unit || '',
    ACTIVO: true,
    DESCRIPCION: `Fixture for ${key}`,
    MODIFICADO_EN: '',
    MODIFICADO_POR: '',
    ...overrides
  };
}

function completeConfigRows(overrides = {}) {
  const values = {
    TEMPORADA: 'PILOT_TEST',
    CONVOCADOS_A: '18',
    CONVOCADOS_B: '18',
    CONFIRMACION_PADRES: 'false',
    ASISTENCIA_VALOR: '1',
    RETARDO_VALOR: '0.75',
    FALTA_INJUSTIFICADA_VALOR: '0',
    FALTA_JUSTIFICADA_VALOR: '1',
    LESION_VALOR: '1',
    HORAS_JUSTIFICACION: '24',
    ROTACION_OBLIGATORIA: 'TRUE',
    MAX_SIN_CONVOCATORIA: '1',
    MIN_PORTEROS: '1',
    MIN_DEFENSAS: '4',
    MIN_MEDIOS: '4',
    MIN_DELANTEROS: '3',
    ESCALA_CALIFICACION_MIN: '1',
    ESCALA_CALIFICACION_MAX: '5',
    CALIFICACION_DECIMALES: 'NO',
    CONTROL_MINUTOS_A: 'SI',
    CONTROL_MINUTOS_B: true,
    ALERTA_SUPLENCIAS_CONSECUTIVAS: '3',
    ROJA_BLOQUEA_CONVOCATORIA: 'TRUE',
    AVISO_AUSENCIA_EMAIL: 'TRUE',
    CONVOCATORIA_EMAIL: 'TRUE',
    ...overrides
  };

  return CONFIG_SCHEMA.map((schema) => row(schema.key, values[schema.key]));
}

module.exports = {
  completeConfigRows,
  row
};
