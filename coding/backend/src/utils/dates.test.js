const test = require('node:test');
const assert = require('node:assert/strict');
const { toDateKey, addDays } = require('./dates');
test('quests change day at midnight Bangkok, independent of host timezone', () => {
  assert.equal(toDateKey(new Date('2026-10-10T16:59:59.999Z')), '2026-10-10');
  assert.equal(toDateKey(new Date('2026-10-10T17:00:00.000Z')), '2026-10-11');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
