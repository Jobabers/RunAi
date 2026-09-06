const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrainingSessions } = require('./trainingPlanner');

test('creates daily quest sessions with rest days and locked future status', () => {
  const goal = { target_distance: 10 };
  const runs = [{ distance: 4, duration_minutes: 32 }];
  const sessions = createTrainingSessions({
    startDate: '2026-08-30',
    weeks: 2,
    goal,
    runs,
  });

  assert.ok(sessions.length > 0);
  assert.equal(sessions[0].session_date, '2026-08-30');
  assert.equal(sessions[0].status, 'available');
  assert.equal(sessions[1].status, 'locked');
  assert.ok(sessions.every((session) => session.target_distance <= 10));
});
