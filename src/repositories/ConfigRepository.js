const CONFIG_ERRORS = {
  DUPLICATE_KEY: 'CONFIG_DUPLICATE_KEY',
  REQUIRED_KEY_MISSING: 'CONFIG_REQUIRED_KEY_MISSING',
  INACTIVE_KEY: 'CONFIG_INACTIVE_KEY'
};

function createConfigError(code, detail) {
  return new Error(detail ? `${code}: ${detail}` : code);
}

function normalizeActive(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();

    if (normalized === 'TRUE' || normalized === 'SI') {
      return true;
    }

    if (normalized === 'FALSE' || normalized === 'NO') {
      return false;
    }
  }

  return Boolean(value);
}

function normalizeRecord(row) {
  return {
    configId: row.CONFIG_ID,
    group: row.GRUPO,
    key: row.CLAVE,
    value: row.VALOR,
    type: row.TIPO,
    unit: row.UNIDAD,
    active: normalizeActive(row.ACTIVO),
    description: row.DESCRIPCION,
    modifiedAt: row.MODIFICADO_EN,
    modifiedBy: row.MODIFICADO_POR,
    raw: row
  };
}

function readRows(source) {
  if (Array.isArray(source)) {
    return source;
  }

  if (source && typeof source.getRows === 'function') {
    return source.getRows();
  }

  throw new Error('Config source is required');
}

function createConfigRepository(source) {
  function getAllRecords() {
    return readRows(source).map(normalizeRecord);
  }

  function getByKey(key) {
    const matches = getAllRecords().filter((record) => record.key === key);

    if (matches.length > 1) {
      throw createConfigError(CONFIG_ERRORS.DUPLICATE_KEY, key);
    }

    if (matches.length === 0) {
      throw createConfigError(CONFIG_ERRORS.REQUIRED_KEY_MISSING, key);
    }

    const record = matches[0];

    if (!record.active) {
      throw createConfigError(CONFIG_ERRORS.INACTIVE_KEY, key);
    }

    return record;
  }

  return {
    get: getByKey,
    getAll: getAllRecords
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG_ERRORS,
    createConfigRepository
  };
}
