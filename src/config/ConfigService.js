const CONFIG_SERVICE_ERRORS = {
  REQUIRED_KEY_MISSING: 'CONFIG_REQUIRED_KEY_MISSING',
  INVALID_TYPE: 'CONFIG_INVALID_TYPE',
  UNKNOWN_KEY: 'CONFIG_UNKNOWN_KEY',
  SCHEMA_INVALID: 'CONFIG_SCHEMA_INVALID',
  DUPLICATE_KEY: 'CONFIG_DUPLICATE_KEY',
  INACTIVE_KEY: 'CONFIG_INACTIVE_KEY'
};

function createConfigServiceError(code, detail) {
  return new Error(detail ? `${code}: ${detail}` : code);
}

function getRuntimeConfigSchema() {
  if (typeof globalThis !== 'undefined' && Array.isArray(globalThis.CONFIG_SCHEMA)) {
    return globalThis.CONFIG_SCHEMA;
  }

  throw createConfigServiceError(CONFIG_SERVICE_ERRORS.SCHEMA_INVALID, 'CONFIG_SCHEMA is required');
}

function getRuntimeConfigTypes() {
  if (typeof globalThis !== 'undefined' && globalThis.CONFIG_TYPES) {
    return globalThis.CONFIG_TYPES;
  }

  throw createConfigServiceError(CONFIG_SERVICE_ERRORS.SCHEMA_INVALID, 'CONFIG_TYPES is required');
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
  const configTypes = getRuntimeConfigTypes();

  if (schema.type === configTypes.INTEGER) {
    converted = parseInteger(record.value, schema.key);
  } else if (schema.type === configTypes.DECIMAL) {
    converted = parseDecimal(record.value, schema.key);
  } else if (schema.type === configTypes.BOOLEAN) {
    converted = normalizeBoolean(record.value, schema.key);
  } else if (schema.type === configTypes.STRING || schema.type === configTypes.ENUM) {
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

function assertRecordIntegrity(record, schema, seenKeys, seenConfigIds) {
  if (seenKeys.has(record.key)) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.DUPLICATE_KEY, record.key);
  }

  seenKeys.add(record.key);

  if (typeof record.configId !== 'string' || record.configId.trim() === '') {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.SCHEMA_INVALID, 'CONFIG_ID');
  }

  if (seenConfigIds.has(record.configId)) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.SCHEMA_INVALID, `CONFIG_ID ${record.configId}`);
  }

  seenConfigIds.add(record.configId);

  if (record.group !== schema.group) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.SCHEMA_INVALID, schema.key);
  }

  if (record.type !== schema.type) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, schema.key);
  }

  if (schema.unit && record.unit !== schema.unit) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.SCHEMA_INVALID, schema.key);
  }

  if (schema.required && !record.active) {
    throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INACTIVE_KEY, schema.key);
  }
}

function createConfigService(configRepository, options = {}) {
  ensureRepository(configRepository);
  const schemaEntries = options.schema || getRuntimeConfigSchema();
  const configTypes = options.types || getRuntimeConfigTypes();

  function getTyped(key, expectedType) {
    const schema = assertKnownKey(schemaEntries, key);

    if (schema.type !== expectedType) {
      throw createConfigServiceError(CONFIG_SERVICE_ERRORS.INVALID_TYPE, key);
    }

    return convertValue(configRepository.get(key), schema);
  }

  return {
    getString(key) {
      return getTyped(key, configTypes.STRING);
    },

    getInteger(key) {
      return getTyped(key, configTypes.INTEGER);
    },

    getDecimal(key) {
      return getTyped(key, configTypes.DECIMAL);
    },

    getBoolean(key) {
      return getTyped(key, configTypes.BOOLEAN);
    },

    getEnum(key) {
      return getTyped(key, configTypes.ENUM);
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
      const seenKeys = new Set();
      const seenConfigIds = new Set();

      for (const record of records) {
        const schema = assertKnownKey(schemaEntries, record.key);
        assertRecordIntegrity(record, schema, seenKeys, seenConfigIds);
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
    CONFIG_SERVICE_ERRORS,
    createConfigService,
    normalizeBoolean
  };
}
