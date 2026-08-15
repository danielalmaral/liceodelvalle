const test = require('node:test');
const assert = require('node:assert/strict');
const { scanGasRuntimeCompatibility } = require('../../scripts/validate');

test('src files do not require CommonJS or ES module syntax for Apps Script runtime', () => {
  assert.deepEqual(scanGasRuntimeCompatibility(), []);
});
