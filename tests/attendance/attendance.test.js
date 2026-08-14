const test = require('node:test');
const assert = require('node:assert/strict');
const { createAttendanceRules } = require('../../src/domain/AttendanceRules');

test('attendance rules remain unimplemented in P0', () => {
  const rules = createAttendanceRules({});

  assert.throws(() => rules.evaluate(), /later phase/);
});
