// Run from coding/backend with RUNAI_LIVE_TEST=1. Creates and removes one test user.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const config = require('../src/config');
const { toDateKey, addDays } = require('../src/utils/dates');

async function main() {
  assert.equal(process.env.RUNAI_LIVE_TEST, '1', 'Set RUNAI_LIVE_TEST=1 to authorize live test data and Gemini calls');
  assert.equal(config.storageDriver, 'supabase');
  assert.equal(config.ai.provider, 'gemini');
  const app = require('../src/app');
  const store = require('../src/storage');
  const { createPendingAdjustment } = require('../src/routes/trainingPlans');
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const email = `runai-sprint3-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomBytes(24).toString('base64url');
  let userId;
  let token;
  const admin = async (suffix, method, body) => {
    const response = await fetch(`${config.supabase.authUrl}/admin/users${suffix}`, {
      method, headers: { apikey: config.supabase.serviceRoleKey, Authorization: `Bearer ${config.supabase.serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
    });
    assert.ok(response.ok, `Auth admin ${method}: HTTP ${response.status}`);
    return response.json();
  };
  const api = async (url, method = 'GET', body, expected = 200) => {
    const response = await fetch(base + url, { method, headers: { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(150000) });
    const data = await response.json();
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${method} ${url}: ${response.status} ${data.error?.message || ''}`);
    return { ...data, http_status: response.status };
  };
  try {
    const user = await admin('', 'POST', { email, password, email_confirm: true });
    userId = user.id || user.user?.id;
    assert.ok(userId);
    const sessionResponse = await fetch(`${config.supabase.authUrl}/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: config.supabase.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20000),
    });
    const session = await sessionResponse.json();
    assert.ok(sessionResponse.ok, `Supabase Auth test session: HTTP ${sessionResponse.status}`);
    token = session.access_token;
    assert.ok(config.supabase.publishableKey, 'Publishable key required for RPC permission test');
    for (const [name, body] of [['runai_mutate', { p_user: userId, p_action: 'refresh', p_data: {} }], ['get_runai_dashboard', { requested_user_id: userId }]]) {
      const anonymous = await fetch(`${config.supabase.restUrl}/rpc/${name}`, { method: 'POST', headers: { apikey: config.supabase.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      assert.ok([401, 403].includes(anonymous.status), `${name} must reject public keys`);
    }
    console.log('PASS public keys cannot call privileged mutation/dashboard RPCs');
    await api('/me', 'PUT', { name: 'Sprint 3 live test', age: 25, weight: 65, height: 170, experience_level: 'intermediate' });
    await api('/runs', 'POST', { run_date: toDateKey(), distance: 5, duration_minutes: 30, run_type: 'Easy Run' }, 201);
    const { goal } = await api('/goals', 'POST', { goal_type: 'distance', target_distance: 10, target_duration_minutes: 50, target_date: addDays(toDateKey(), 7) }, 201);
    console.log('PASS Supabase Auth, profile, first run and goal');
    const { plan } = await api('/training-plans/generate', 'POST', { goal_id: goal.goal_id }, 201);
    console.log(`Training plan provider: ${plan.source}`);
    const today = plan.sessions.find((session) => session.session_date === toDateKey());
    assert.ok(today, 'Expected a first-day quest');
    const parallelSubmissions = await Promise.all([1, 2].map(() => api(`/training-sessions/${today.training_session_id}/submit`, 'POST', { actual_distance: 10, actual_duration_minutes: 55 }, [201, 409])));
    assert.deepEqual(parallelSubmissions.map((item) => item.http_status).sort(), [201, 409]);
    const submitted = parallelSubmissions.find((item) => item.http_status === 201);
    assert.equal((await store.listRunsForUser(userId)).length, 2);
    assert.equal(submitted.progress.status, 'completed');
    assert.equal(submitted.goal_completion, null);
    assert.equal((await api('/goals')).goals[0].achieved_at, null);
    console.log('PASS 10km/55min: Quest completed, Goal not achieved');
    console.log('PASS concurrent submissions: exactly one run/progress saved');
    const achieved = await api('/runs', 'POST', { run_date: toDateKey(), distance: 10, duration_minutes: 50, run_type: 'Tempo Run' }, 201);
    assert.ok(achieved.goal_completion.goal.achieved_at);
    assert.equal(achieved.goal_completion.goal.status, 'active');
    assert.equal((await api('/training-plans/active')).plan.status, 'active');
    await api(`/goals/${goal.goal_id}/continue`, 'PATCH');
    const dashboard = await api('/dashboard');
    assert.equal(dashboard.goals[0].achievement_choice, 'continue');
    assert.equal(dashboard.active_plan.status, 'active');
    console.log('PASS achievement persists through dashboard RPC; continuing keeps plan active');
    const insight = await api('/insights', 'POST', undefined, 201);
    assert.equal(insight.analysis.result_json.source, 'gemini');
    assert.ok(insight.analysis.result_json.summary);
    const cached = await api('/insights', 'POST');
    assert.equal(cached.analysis.ai_analysis_id, insight.analysis.ai_analysis_id);
    console.log('PASS real Gemini analysis saved in Supabase and reused without another call');
    const userProfile = await store.findUserById(userId);
    const failure = async (daysAgo) => {
      const session = await store.createRecord('training_sessions', { training_plan_id: plan.training_plan_id, session_date: addDays(toDateKey(), -daysAgo), training_type: 'Easy Run', target_distance: 5, target_duration_minutes: 30, status: 'failed', note: 'Disposable live-test fixture' });
      await store.createRecord('training_progress', { training_session_id: session.training_session_id, status: 'failed', failure_reason: 'Could not complete training due to fatigue', submitted_at: new Date().toISOString() });
      return session;
    };
    const adjustment1 = await createPendingAdjustment({ user: userProfile, plan: await store.findPlanById(plan.training_plan_id), failedSession: await failure(1), reason: 'Fatigue' });
    const history1 = await api('/plan-history');
    assert.equal(history1.adjustments[0].analysis.source, 'gemini', 'Adjustment must come from real Gemini');
    const originalSessions = await store.getPlanSessions(plan.training_plan_id);
    const rejection = await Promise.all([1, 2].map(() => api(`/training-plans/adjustments/${adjustment1.plan_adjustment_id}/reject`, 'POST', undefined, [200, 409])));
    assert.deepEqual(rejection.map((item) => item.http_status).sort(), [200, 409]);
    assert.equal((await store.findPlanById(plan.training_plan_id)).version, 1);
    assert.deepEqual((await store.getPlanSessions(plan.training_plan_id)).map((item) => item.training_session_id), originalSessions.map((item) => item.training_session_id));
    console.log('PASS real Gemini adjustment rejected concurrently without changing sessions/version');
    const adjustment2 = await createPendingAdjustment({ user: userProfile, plan: await store.findPlanById(plan.training_plan_id), failedSession: await failure(2), reason: 'Fatigue' });
    assert.ok(adjustment2.proposed_sessions.length);
    const snapshot = await store.getPlanSessions(plan.training_plan_id);
    const invalidSessions = adjustment2.proposed_sessions.map((item, index) => index ? item : { ...item, target_distance: -1 });
    await store.updateRecord('plan_adjustments', adjustment2.plan_adjustment_id, { proposed_sessions: invalidSessions });
    await api(`/training-plans/adjustments/${adjustment2.plan_adjustment_id}/accept`, 'POST', undefined, 500);
    assert.deepEqual(await store.getPlanSessions(plan.training_plan_id), snapshot, 'Failed replacement must roll back deleted sessions');
    assert.equal((await store.findAdjustmentById(adjustment2.plan_adjustment_id)).status, 'pending');
    assert.equal((await store.findPlanById(plan.training_plan_id)).version, 1);
    await store.updateRecord('plan_adjustments', adjustment2.plan_adjustment_id, { proposed_sessions: adjustment2.proposed_sessions });
    const acceptance = await Promise.all([1, 2].map(() => api(`/training-plans/adjustments/${adjustment2.plan_adjustment_id}/accept`, 'POST', undefined, [200, 409])));
    assert.deepEqual(acceptance.map((item) => item.http_status).sort(), [200, 409]);
    assert.equal((await store.findPlanById(plan.training_plan_id)).version, 2);
    const after = await store.getPlanSessions(plan.training_plan_id);
    for (const session of snapshot.filter((item) => item.session_date <= toDateKey())) assert.ok(after.some((item) => item.training_session_id === session.training_session_id));
    console.log('PASS transaction rollback and concurrent acceptance; past/today preserved, version incremented once');
    const expired = await store.createRecord('training_sessions', { training_plan_id: plan.training_plan_id, session_date: addDays(toDateKey(), -3), training_type: 'Easy Run', target_distance: 3, target_duration_minutes: 20, status: 'available', note: 'Disposable expiry fixture' });
    await Promise.all([1, 2].map(() => store.atomicMutate(userId, 'refresh', { plan_id: plan.training_plan_id })));
    const expiredProgress = await store.findProgressBySessionId(expired.training_session_id);
    assert.equal(expiredProgress.status, 'expired');
    assert.equal(new Date(expiredProgress.submitted_at).toISOString(), new Date(`${addDays(expired.session_date, 1)}T00:00:00+07:00`).toISOString());
    assert.equal((await store.listRunsForUser(userId)).length, 3);
    console.log('PASS concurrent expiry refresh uses Bangkok midnight and creates no running record');
    const closedResults = await Promise.all([1, 2].map(() => api(`/goals/${goal.goal_id}/complete`, 'PATCH', undefined, [200, 409])));
    assert.deepEqual(closedResults.map((item) => item.http_status).sort(), [200, 409]);
    const closed = closedResults.find((item) => item.http_status === 200);
    assert.equal(closed.goal.status, 'completed');
    assert.equal(closed.active_plan.status, 'completed');
    await api(`/training-sessions/${today.training_session_id}/submit`, 'POST', { actual_distance: 10, actual_duration_minutes: 50 }, 409);
    console.log('PASS complete choice closes goal/plan and blocks later submissions');
    assert.equal(plan.source, 'gemini', 'Training generation used a fallback, not Gemini');
  } finally {
    try {
      if (userId) { await admin(`/${userId}`, 'DELETE'); console.log('PASS temporary Supabase user and cascading test data removed'); }
    } finally { await new Promise((resolve) => server.close(resolve)); }
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
