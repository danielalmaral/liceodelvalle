const {
  CONFIG_SCHEMA,
  CONFIG_TYPES
} = require('./ConfigSchema');

const CONFIG_SERVICE_ERRORS = {
  REQUIRED_KEY_MISSING: 'CONFIG_REQUIRED_KEY_MISSING',
  INVALID_TYPE: 'CONFIG_INVALID_TYPE',
  UNKNOWN_KEY: 'CONFIG_UNKNOWN_KEY',
  SCHEMA_INVALID: 'CONFIG_SCHEMA_INVALID'
};

function createConfigServiceError(code, detail) {
  return new Error(detail ? `${code}: ${detail}` : code);
}

function ensureRepository(configRepository) {
  if (!configRepository || typeof configRepository.get !== 'function' || typeof configRepository.getAll !== 'function') {
    throw new Error('ConfigRepository is required');
  }
}

function findSchemaByKey(schemaEntries, key) {
  return schemaEntries.find((entry) => entry.key === key);
}

function assertKnownKey(schemaEntries, key) {
  const schema = findSchemaByKey(schemaEntries, key);

  if (!schema) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.UNKNOWN_KEY, key);
  }

  return schema;
}

function normalizeBoolean(value, key) {
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

  throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, key);
}

function parseInteger(value, key) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number(value);
  }

  throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, key);
}

function parseDecimal(value, key) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }

  throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, key);
}

function parseString(value, key) {
  if (typeof value === 'string') {
    return value;
  }

  throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, key);
}

function assertStructuralValidation(schema, value) {
  if (schema.validate === 'positiveInteger' && (!Number.isInteger(value) || value <= 0)) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, schema.key);
  }

  if (schema.validate === 'nonNegativeDecimal' && (typeof value !== 'number' || value < 0)) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, schema.key);
  }
}

function convertValue(record, schema) {
  if (record.type !== schema.type) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, schema.key);
  }

  let converted;

  if (schema.type === CONFIG_TYPES.INTEGER) {
    converted = parseInteger(record.value, schema.key);
  } else if (schema.type === CONFIG_TYPES.DECIMAL) {
    converted = parseDecimal(record.value, schema.key);
  } else if (schema.type === CONFIG_TYPES.BOOLEAN) {
    converted = normalizeBoolean(record.value, schema.key);
  } else if (schema.type === CONFIG_TYPES.STRING || schema.type === CONFIG_TYPES.ENUM) {
    converted = parseString(record.value, schema.key);
  } else {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.SCHEMA_INVALID, schema.key);
  }

  assertStructuralValidation(schema, converted);

  return converted;
}

function getRequiredKeys(schemaEntries) {
  return schemaEntries.filter((entry) => entry.required).map((entry) => entry.key);
}

function createConfigService(configRepository, options = {}) {
  ensureRepository(configRepository);
  const schemaEntries = options.schema || CONFIG_SCHEMA;

  function getTyped(key, expectedType) {
    const schema = assertKnownKey(schemaEntries, key);

    if (schema.type !== expectedType) {
      throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, key);
    }

    return convertValue(configRepository.get(key), schema);
  }

  return {
    getString(key) {
      return getTyped(key, CONFIG_TYPES.STRING);
    },

    getInteger(key) {
      return getTyped(key, CONFIG_TYPES.INTEGER);
    },

    getDecimal(key) {
      return getTyped(key, CONFIG_TYPES.DECIMAL);
    },

    getBoolean(key) {
      return getTyped(key, CONFIG_TYPES.BOOLEAN);
    },

    getEnum(key) {
      return getTyped(key, CONFIG_TYPES.ENUM);
    },

    getRaw(key) {
      assertKnownKey(schemaEntries, key);
      return configRepository.get(key);
    },

    getAll() {
      return configRepository.getAll().map((record) => {
        const schema = assertKnownKey(schemaEntries, record.key);

        return {
          ...record,
          value: convertValue(record, schema)
        };
      });
    },

    getValue(key) {
      const schema = assertKnownKey(schemaEntries, key);
      return convertValue(configRepository.get(key), schema);
    },

    validateRequiredConfig() {
      const records = configRepository.getAll();
      const seen = new Set();

      for (const record of records) {
        if (seen.has(record.key)) {
          throw createConfigServiceError('CONFIG_DUPLICATE_KEY', record.key);
        }

        seen.add(record.key);
        const schema = assertKnownKey(schemaEntries, record.key);
        convertValue(record, schema);
      }

      for (const key of getRequiredKeys(schemaEntries)) {
        const schema = assertKnownKey(schemaEntries, key);
        const record = configRepository.get(key);
        convertValue(record, schema);
      }

      return true;
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG_SCHEMA,
    CONFIG_SERVICE_ERRORS,
    createConfigService,
    normalizeBoolean
  };
}
