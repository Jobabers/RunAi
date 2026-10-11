const test = require('node:test');
const assert = require('node:assert/strict');
process.env.STORAGE_DRIVER = 'memory';
process.env.AI_PROVIDER = 'rule-based';
const app = require('./app');
const store = require('./storage');
const auth = require('./services/authProvider');
const config = require('./config');
const { toDateKey, addDays } = require('./utils/dates');
const { progressMetrics } = require('./services/progressMetrics');

test('weighted pace uses total duration/distance and separates recent samples', () => {
  const runs = Array.from({ length: 6 }, (_, index) => ({ run_id: index + 1, run_date: '2026-10-01', distance: index + 1, duration_minutes: 30 }));
  const metrics = progressMetrics(runs);
  assert.equal(metrics.recent.count, 5);
  assert.equal(metrics.recent.pace_minutes_per_km, 150 / 20);
  assert.equal(metrics.previous.count, 1);
  assert.equal(metrics.previous.pace_minutes_per_km, 30);
  assert.deepEqual(metrics.sample_run_ids, [6, 5, 4, 3, 2, 1]);
  assert.equal(progressMetrics([]).recent.pace_minutes_per_km, null);
});

test('Sprint 3 analysis, history ownership, failed quest recovery and Gemini validation', async (t) => {
  store.resetForTests(); auth.resetForTests();
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const originalFetch = global.fetch;
  const originalAI = { ...config.ai };
  t.after(() => { global.fetch = originalFetch; Object.assign(config.ai, originalAI); });
  const request = async (path, method = 'GET', body, token = '') => {
    const response = await originalFetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  };
  const createUser = async (email) => {
    await request('/auth/register', 'POST', { email, password: 'test-password-123' });
    return (await request('/auth/login', 'POST', { email, password: 'test-password-123' })).data;
  };
  const owner = await createUser('sprint3-owner@example.com');
  const other = await createUser('sprint3-other@example.com');
  const goal = store.createRecord('goals', { user_id: owner.user.user_id, status: 'active', target_distance: 10, target_duration_minutes: 50, target_date: addDays(toDateKey(), 10) });
  const plan = store.createRecord('training_plans', { user_id: owner.user.user_id, goal_id: goal.goal_id, status: 'active', version: 1, start_date: toDateKey(), end_date: addDays(toDateKey(), 10) });
  const session = store.createRecord('training_sessions', { training_plan_id: plan.training_plan_id, session_date: toDateKey(), target_distance: 5, training_type: 'Easy Run', target_duration_minutes: 30, status: 'available' });
  store.createRecord('training_sessions', { training_plan_id: plan.training_plan_id, session_date: addDays(toDateKey(), 1), target_distance: 6, training_type: 'Easy Run', target_duration_minutes: 40, status: 'locked' });
  store.createRecord('runs', { user_id: owner.user.user_id, distance: 5, duration_minutes: 30, run_date: toDateKey() });
  assert.equal((await request(`/training-plans/${plan.training_plan_id}/history`, 'GET', null, other.token)).status, 404);
  const createRecord = store.createRecord;
  store.createRecord = (table, attrs) => { if (table === 'plan_adjustments') throw new Error('simulated storage failure'); return createRecord(table, attrs); };
  let failed;
  try {
    failed = await request(`/training-sessions/${session.training_session_id}/fail`, 'POST', { actual_distance: 3, actual_duration_minutes: 20, failure_reason: 'Fatigue' }, owner.token);
  } finally { store.createRecord = createRecord; }
  assert.equal(failed.status, 201);
  assert.equal(failed.data.analysis_retry_required, true);
  assert.equal(store.db.training_progress.length, 1);
  const recovered = await request(`/training-plans/${plan.training_plan_id}/retry-analysis`, 'POST', null, owner.token);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.data.adjustment.status, 'pending');
  assert.equal(store.db.training_progress.length, 1);
  assert.equal(store.db.runs.length, 2);
  const history = await request('/plan-history', 'GET', null, owner.token);
  assert.equal(history.data.adjustments.length, 1);
  assert.equal(history.data.adjustments[0].analysis.previous_sessions.length, 1);
  assert.equal((await request('/plan-history', 'GET', null, other.token)).data.adjustments.length, 0);
  assert.equal((await request('/insights', 'POST', null, owner.token)).status, 503);
  assert.equal(store.db.ai_analysis.filter((row) => row.trigger_type === 'progress_review').length, 0);
  Object.assign(config.ai, { provider: 'gemini', geminiApiKey: 'test-key', model: 'gemini-2.5-flash' });
  let calls = 0;
  global.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/generativelanguage.googleapis.com\//);
    calls += 1;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Recent running results', recommendation: 'Continue the current plan' }) }] } }] }), { status: 200 });
  };
  const analyzed = await request('/insights', 'POST', null, owner.token);
  assert.equal(analyzed.status, 201);
  assert.equal(analyzed.data.analysis.result_json.source, 'gemini');
  assert.equal((await request('/insights', 'POST', null, owner.token)).status, 200);
  assert.equal(calls, 1);
  assert.equal((await request('/insights', 'GET', null, other.token)).data.analysis, null);
  store.createRecord('runs', { user_id: owner.user.user_id, distance: 4, duration_minutes: 24, run_date: toDateKey() });
  global.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: '', recommendation: null }) }] } }] }), { status: 200 });
  assert.equal((await request('/insights', 'POST', null, owner.token)).status, 503);
  assert.equal(store.db.ai_analysis.filter((row) => row.trigger_type === 'progress_review').length, 1);
  assert.equal((await request('/insights', 'GET', null, owner.token)).data.analysis.ai_analysis_id, analyzed.data.analysis.ai_analysis_id);
});
