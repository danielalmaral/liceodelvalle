const test = require('node:test');
const assert = require('node:assert/strict');
const { createEligibilityRules } = require('../../src/domain/EligibilityRules');

test('eligibility rules remain unimplemented in P0', () => {
  const rules = createEligibilityRules({});

  assert.throws(() => rules.evaluate(), /later phase/);
});
