const test = require('node:test');
const assert = require('node:assert/strict');
const { createConfigService } = require('../../src/config/ConfigService');
const { CONFIG_TYPES } = require('../../src/config/ConfigSchema');
const { createConfigRepository } = require('../../src/repositories/ConfigRepository');
const { completeConfigRows, row } = require('./config-fixtures');

function serviceFromRows(rows, options) {
  return createConfigService(createConfigRepository(rows), options);
}

test('reads INTEGER values strictly', () => {
  const service = serviceFromRows(completeConfigRows());

  assert.equal(service.getInteger('CONVOCADOS_A'), 18);
});

test('reads DECIMAL values strictly', () => {
  const service = serviceFromRows(completeConfigRows());

  assert.equal(service.getDecimal('RETARDO_VALOR'), 0.75);
});

test('reads BOOLEAN values with explicit normalization', () => {
  const cases = [
    ['true', true],
    ['false', false],
    ['TRUE', true],
    ['FALSE', false],
    ['SI', true],
    ['NO', false],
    [true, true],
    [false, false]
  ];

  for (const [input, expected] of cases) {
    const service = serviceFromRows(completeConfigRows({ CONFIRMACION_PADRES: input }));

    assert.equal(service.getBoolean('CONFIRMACION_PADRES'), expected);
  }
});

test('boolean normalization rejects unsupported truthy strings', () => {
  const service = serviceFromRows(completeConfigRows({ CONFIRMACION_PADRES: 'yes' }));

  assert.throws(() => service.getBoolean('CONFIRMACION_PADRES'), /CONFIG_INVALID_TYPE: CONFIRMACION_PADRES/);
});

test('reads STRING values', () => {
  const service = serviceFromRows(completeConfigRows({ TEMPORADA: 'TEMPORADA_TEST' }));

  assert.equal(service.getString('TEMPORADA'), 'TEMPORADA_TEST');
});

test('reads ENUM values when schema defines an enum config', () => {
  const schema = [{ key: 'MODO_TEST', group: 'GENERAL', type: CONFIG_TYPES.ENUM, required: true }];
  const rows = [row('TEMPORADA', 'PILOT_TEST', { CLAVE: 'MODO_TEST', TIPO: CONFIG_TYPES.ENUM, VALOR: 'PILOTO' })];
  const service = serviceFromRows(rows, { schema });

  assert.equal(service.getEnum('MODO_TEST'), 'PILOTO');
});

test('missing required key fails closed without fallback', () => {
  const rows = completeConfigRows().filter((record) => record.CLAVE !== 'CONVOCADOS_A');
  const service = serviceFromRows(rows);

  assert.throws(() => service.getInteger('CONVOCADOS_A'), /CONFIG_REQUIRED_KEY_MISSING: CONVOCADOS_A/);
  assert.throws(() => service.validateRequiredConfig(), /CONFIG_REQUIRED_KEY_MISSING: CONVOCADOS_A/);
});

test('duplicate key is rejected', () => {
  const rows = completeConfigRows();
  const service = serviceFromRows([...rows, row('CONVOCADOS_A', '19')]);

  assert.throws(() => service.getInteger('CONVOCADOS_A'), /CONFIG_DUPLICATE_KEY: CONVOCADOS_A/);
});

test('inactive required key is rejected', () => {
  const rows = completeConfigRows().map((record) => {
    if (record.CLAVE === 'CONVOCADOS_A') {
      return { ...record, ACTIVO: false };
    }

    return record;
  });
  const service = serviceFromRows(rows);

  assert.throws(() => service.getInteger('CONVOCADOS_A'), /CONFIG_INACTIVE_KEY: CONVOCADOS_A/);
});

test('ACTIVO accepts only explicit boolean representations', () => {
  const validCases = [true, false, 'TRUE', 'FALSE', 'SI', 'NO', ' true ', ' no '];

  for (const active of validCases) {
    const service = serviceFromRows(completeConfigRows({ CONVOCADOS_A: '18' }).map((record) => {
      if (record.CLAVE === 'CONVOCADOS_A') {
        return { ...record, ACTIVO: active };
      }

      return record;
    }));

    if (active === false || String(active).trim().toUpperCase() === 'FALSE' || String(active).trim().toUpperCase() === 'NO') {
      assert.throws(() => service.getInteger('CONVOCADOS_A'), /CONFIG_INACTIVE_KEY: CONVOCADOS_A/);
    } else {
      assert.equal(service.getInteger('CONVOCADOS_A'), 18);
    }
  }
});

test('ACTIVO rejects implicit truthy and invalid values', () => {
  const invalidCases = ['yes', 'ERROR', '1', 1, null];

  for (const active of invalidCases) {
    const rows = completeConfigRows().map((record) => {
      if (record.CLAVE === 'CONVOCADOS_A') {
        return { ...record, ACTIVO: active };
      }

      return record;
    });
    const service = serviceFromRows(rows);

    assert.throws(() => service.getInteger('CONVOCADOS_A'), /CONFIG_INVALID_TYPE: ACTIVO/);
  }
});

test('invalid INTEGER type is rejected', () => {
  const service = serviceFromRows(completeConfigRows({ CONVOCADOS_A: 'dieciocho' }));

  assert.throws(() => service.getInteger('CONVOCADOS_A'), /CONFIG_INVALID_TYPE: CONVOCADOS_A/);
});

test('invalid DECIMAL type is rejected', () => {
  const service = serviceFromRows(completeConfigRows({ RETARDO_VALOR: 'abc' }));

  assert.throws(() => service.getDecimal('RETARDO_VALOR'), /CONFIG_INVALID_TYPE: RETARDO_VALOR/);
});

test('unknown schema key is rejected explicitly', () => {
  const service = serviceFromRows(completeConfigRows());

  assert.throws(() => service.getRaw('NO_EXISTE'), /CONFIG_UNKNOWN_KEY: NO_EXISTE/);
});

test('dynamic repository value changes runtime result without code changes', () => {
  const rows = completeConfigRows({ RETARDO_VALOR: '0.75' });
  const source = { getRows: () => rows };
  const service = createConfigService(createConfigRepository(source));

  assert.equal(service.getDecimal('RETARDO_VALOR'), 0.75);

  const retardo = rows.find((record) => record.CLAVE === 'RETARDO_VALOR');
  retardo.VALOR = '0.80';

  assert.equal(service.getDecimal('RETARDO_VALOR'), 0.8);
});

test('validateRequiredConfig accepts complete active typed config', () => {
  const service = serviceFromRows(completeConfigRows());

  assert.equal(service.validateRequiredConfig(), true);
});

test('validateRequiredConfig rejects wrong GRUPO metadata', () => {
  const rows = completeConfigRows().map((record) => {
    if (record.CLAVE === 'CONVOCADOS_A') {
      return { ...record, GRUPO: 'GENERAL' };
    }

    return record;
  });
  const service = serviceFromRows(rows);

  assert.throws(() => service.validateRequiredConfig(), /CONFIG_SCHEMA_INVALID: CONVOCADOS_A/);
});

test('validateRequiredConfig rejects duplicate CONFIG_ID metadata', () => {
  const rows = completeConfigRows().map((record) => {
    if (record.CLAVE === 'CONVOCADOS_B') {
      return { ...record, CONFIG_ID: 'CFG_CONVOCADOS_A' };
    }

    return record;
  });
  const service = serviceFromRows(rows);

  assert.throws(() => service.validateRequiredConfig(), /CONFIG_SCHEMA_INVALID: CONFIG_ID CFG_CONVOCADOS_A/);
});

test('validateRequiredConfig rejects empty CONFIG_ID metadata', () => {
  const rows = completeConfigRows().map((record) => {
    if (record.CLAVE === 'CONVOCADOS_A') {
      return { ...record, CONFIG_ID: '  ' };
    }

    return record;
  });
  const service = serviceFromRows(rows);

  assert.throws(() => service.validateRequiredConfig(), /CONFIG_SCHEMA_INVALID: CONFIG_ID/);
});

test('validateRequiredConfig rejects incompatible UNIDAD metadata', () => {
  const rows = completeConfigRows().map((record) => {
    if (record.CLAVE === 'CONVOCADOS_A') {
      return { ...record, UNIDAD: 'puntos' };
    }

    return record;
  });
  const service = serviceFromRows(rows);

  assert.throws(() => service.validateRequiredConfig(), /CONFIG_SCHEMA_INVALID: CONVOCADOS_A/);
});
