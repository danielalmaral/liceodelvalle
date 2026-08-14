const test = require('node:test');
const assert = require('node:assert/strict');
const { createConvocationRules } = require('../../src/domain/ConvocationRules');

test('convocation rules remain unimplemented in P0', () => {
  const rules = createConvocationRules({});

  assert.throws(() => rules.evaluate(), /later phase/);
});
