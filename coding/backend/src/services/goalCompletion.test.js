const test = require('node:test');
const assert = require('node:assert/strict');
process.env.STORAGE_DRIVER = 'memory';
const { hasReachedGoalDistance } = require('./goalCompletion');

for (const [distance, duration, expected] of [[10, 50, true], [10.5, 48, true], [10, 55, false], [9, 45, false], [10, 0, false], [10, Infinity, false]]) {
  test(`goal 10km/50min: ${distance}km/${duration}min => ${expected}`, () => {
    assert.equal(hasReachedGoalDistance({ distance, duration_minutes: duration }, { target_distance: 10, target_duration_minutes: 50 }), expected);
  });
}
