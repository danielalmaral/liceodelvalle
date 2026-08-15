const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../src/common/DomainUtils');

test('DOMAIN_TIME_STRING_CANONICAL_TEST', () => {
  assert.equal(utils.normalizeTimeValue('16:00', 'HORA', true), '16:00');
  assert.equal(utils.normalizeTimeValue('8:05', 'HORA', true), '08:05');
  assert.equal(utils.normalizeTimeValue('08:05:00', 'HORA', true), '08:05');
  assert.equal(utils.normalizeTimeValue('   ', 'HORA', false), '');
  assert.throws(() => utils.normalizeTimeValue('   ', 'HORA', true), /REQUIRED_FIELD: HORA/);
});

test('DOMAIN_TIME_DATE_OBJECT_CANONICAL_TEST', () => {
  assert.equal(utils.normalizeTimeValue(new Date(2000, 0, 1, 16, 0, 0, 0), 'HORA', true), '16:00');
  assert.equal(utils.normalizeTimeValue(new Date(2000, 0, 1, 8, 5, 0, 0), 'HORA', true), '08:05');
});

test('DOMAIN_TIME_INVALID_DATE_TEST', () => {
  assert.throws(() => utils.normalizeTimeValue(new Date('invalid'), 'HORA', true), /INVALID_TIME: HORA/);
});

test('DOMAIN_TIME_INVALID_VALUE_TEST', () => {
  ['24:00', '08:60', '08:05:30', 'hora', 805, true].forEach((value) => {
    assert.throws(() => utils.normalizeTimeValue(value, 'HORA', true), /INVALID_TIME: HORA/);
  });
});
