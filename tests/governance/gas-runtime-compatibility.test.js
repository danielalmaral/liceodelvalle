const test = require('node:test');
const assert = require('node:assert/strict');
const { detectConfigHardcodedRules, scanGasRuntimeCompatibility } = require('../../scripts/validate');

test('src files do not require CommonJS or ES module syntax for Apps Script runtime', () => {
  assert.deepEqual(scanGasRuntimeCompatibility(), []);
});

test('CONFIG_FULL_HARDCODE_GUARD_TEST detects hardcoded configurable keys', () => {
  assert.equal(detectConfigHardcodedRules("const MIN_DEFENSAS = 4;", ['MIN_DEFENSAS']), true);
  assert.equal(detectConfigHardcodedRules("configService.getInteger('MIN_DEFENSAS');", ['MIN_DEFENSAS']), false);
});
