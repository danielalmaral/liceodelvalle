const test = require('node:test');
const assert = require('node:assert/strict');
const { createRotationRules } = require('../../src/domain/RotationRules');

test('rotation rules remain unimplemented in P0', () => {
  const rules = createRotationRules({});

  assert.throws(() => rules.evaluate(), /later phase/);
});
