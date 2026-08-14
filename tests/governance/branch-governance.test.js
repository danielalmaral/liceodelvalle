const test = require('node:test');
const assert = require('node:assert/strict');
const { assertValidBranchName } = require('../../scripts/validate');

test('main is allowed for validation', () => {
  assert.doesNotThrow(() => assertValidBranchName('main'));
});

test('feature phase branches are allowed for validation', () => {
  assert.doesNotThrow(() => assertValidBranchName('feature/p1-config'));
});

test('corrective branches are allowed for validation', () => {
  assert.doesNotThrow(() => assertValidBranchName('fix/p0-validator-branch-governance-01'));
});

test('detached or empty branch is rejected', () => {
  assert.throws(() => assertValidBranchName(''), /detached HEAD or empty branch/);
  assert.throws(() => assertValidBranchName('   '), /detached HEAD or empty branch/);
  assert.throws(() => assertValidBranchName('HEAD'), /detached HEAD/);
});
