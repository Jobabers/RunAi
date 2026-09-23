const test = require('node:test');
const assert = require('node:assert/strict');

process.env.STORAGE_DRIVER = 'memory';
process.env.AI_PROVIDER = 'rule-based';

const app = require('./app');
const store = require('./storage');
const authProvider = require('./services/authProvider');
const { addDays, toDateKey } = require('./utils/dates');

function listen(serverApp) {
  return new Promise((resolve) => {
    const server = serverApp.listen(0, () => resolve(server));
  });
}

async function request(baseUrl, path, { method = 'GET', token = '', body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();

  return { response, data };
}

test('supports the first RunAI quest workflow', async (t) => {
  store.resetForTests();
  authProvider.resetForTests();
  const server = await listen(app);
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const register = await request(baseUrl, '/auth/register', {
    method: 'POST',
    body: {
      name: 'Runner One',
      email: 'runner-one@example.com',
      password: 'password123',
    },
  });
  assert.equal(register.response.status, 201);
  assert.equal(register.data.user.email, 'runner-one@example.com');
  assert.equal(register.data.user.name, null);

  const login = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: {
      email: 'runner-one@example.com',
      password: 'password123',
    },
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.data.token);

  const token = login.data.token;
  const earlyPlan = await request(baseUrl, '/training-plans/generate', {
    method: 'POST',
    token,
    body: { weeks: 2 },
  });
  assert.equal(earlyPlan.response.status, 400);
  assert.match(earlyPlan.data.error.message, /Profile/);

  const profile = await request(baseUrl, '/me', {
    method: 'PUT',
    token,
    body: {
      name: 'Runner One',
      age: 20,
      weight: 64,
      height: 172,
      experience_level: 'beginner',
    },
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.data.user.name, 'Runner One');

  const earlyGoal = await request(baseUrl, '/goals', {
    method: 'POST',
    token,
    body: {
      goal_type: 'วิ่ง 5K ให้ดีขึ้น',
      target_distance: 5,
      target_duration_minutes: 35,
      target_date: addDays(toDateKey(), 30),
    },
  });
  assert.equal(earlyGoal.response.status, 400);
  assert.match(earlyGoal.data.error.message, /ประวัติการวิ่ง/);

  const run = await request(baseUrl, '/runs', {
    method: 'POST',
    token,
    body: {
      run_date: toDateKey(),
      distance: 3,
      duration_minutes: 24,
      run_type: 'Easy Run',
    },
  });
  assert.equal(run.response.status, 201);

  const goal = await request(baseUrl, '/goals', {
    method: 'POST',
    token,
    body: {
      goal_type: 'วิ่ง 5K ให้ดีขึ้น',
      target_distance: 5,
      target_duration_minutes: 35,
      target_date: addDays(toDateKey(), 30),
    },
  });
  assert.equal(goal.response.status, 201);

  const duplicateGoal = await request(baseUrl, '/goals', {
    method: 'POST',
    token,
    body: {
      goal_type: 'วิ่ง 10K ให้ดีขึ้น',
      target_distance: 10,
      target_duration_minutes: 65,
      target_date: addDays(toDateKey(), 45),
    },
  });
  assert.equal(duplicateGoal.response.status, 409);
  assert.match(duplicateGoal.data.error.message, /เป้าหมายที่กำลังใช้งาน/);

  const plan = await request(baseUrl, '/training-plans/generate', {
    method: 'POST',
    token,
    body: { goal_id: goal.data.goal.goal_id, weeks: 2 },
  });
  assert.equal(plan.response.status, 201);
  assert.equal(plan.data.plan.sessions[0].status, 'available');

  const session = plan.data.plan.sessions[0];
  const notPassed = await request(baseUrl, `/training-sessions/${session.training_session_id}/submit`, {
    method: 'POST',
    token,
    body: {
      actual_distance: Number(session.target_distance) - 0.5,
      actual_duration_minutes: session.target_duration_minutes,
    },
  });
  assert.equal(notPassed.response.status, 422);
  assert.equal(notPassed.data.error.message, 'เควสยังไม่ผ่าน');

  const failed = await request(baseUrl, `/training-sessions/${session.training_session_id}/fail`, {
    method: 'POST',
    token,
    body: {
      actual_distance: Number(session.target_distance) - 0.5,
      actual_duration_minutes: session.target_duration_minutes,
      failure_reason: 'เจ็บขาเล็กน้อย',
    },
  });
  assert.equal(failed.response.status, 201);
  assert.equal(failed.data.progress.status, 'failed');
  assert.equal(failed.data.pending_adjustment.status, 'pending');

  const duplicateQuestSubmit = await request(baseUrl, `/training-sessions/${session.training_session_id}/submit`, {
    method: 'POST',
    token,
    body: {
      actual_distance: Number(session.target_distance),
      actual_duration_minutes: session.target_duration_minutes,
    },
  });
  assert.equal(duplicateQuestSubmit.response.status, 409);
  assert.match(duplicateQuestSubmit.data.error.message, /ส่งผลแล้ว|ยังไม่เปิด/);

  const activePlanWithAdjustment = await request(baseUrl, '/training-plans/active', {
    token,
  });
  assert.equal(activePlanWithAdjustment.response.status, 200);
  assert.equal(activePlanWithAdjustment.data.plan.pending_adjustment.status, 'pending');
  assert.equal(store.db.plan_adjustments.length, 1);

  const repeatedActivePlanRead = await request(baseUrl, '/training-plans/active', {
    token,
  });
  assert.equal(repeatedActivePlanRead.response.status, 200);
  assert.equal(repeatedActivePlanRead.data.plan.pending_adjustment.plan_adjustment_id, failed.data.pending_adjustment.plan_adjustment_id);
  assert.equal(store.db.plan_adjustments.length, 1);

  const acceptedAdjustment = await request(
    baseUrl,
    `/training-plans/adjustments/${activePlanWithAdjustment.data.plan.pending_adjustment.plan_adjustment_id}/accept`,
    {
      method: 'POST',
      token,
    },
  );
  assert.equal(acceptedAdjustment.response.status, 200);
  assert.equal(acceptedAdjustment.data.adjustment.status, 'accepted');
  assert.equal(acceptedAdjustment.data.plan.version, 2);
});

test('completes a daily quest once and rejects a forced fail after reaching target distance', async (t) => {
  store.resetForTests();
  authProvider.resetForTests();
  const server = await listen(app);
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api`;

  await request(baseUrl, '/auth/register', {
    method: 'POST',
    body: {
      name: 'Quest Finisher',
      email: 'quest-finisher@example.com',
      password: 'password123',
    },
  });

  const login = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: {
      email: 'quest-finisher@example.com',
      password: 'password123',
    },
  });
  const { token } = login.data;

  await request(baseUrl, '/me', {
    method: 'PUT',
    token,
    body: {
      name: 'Quest Finisher',
      age: 22,
      weight: 62,
      height: 170,
      experience_level: 'beginner',
    },
  });

  await request(baseUrl, '/runs', {
    method: 'POST',
    token,
    body: {
      run_date: toDateKey(),
      distance: 4,
      duration_minutes: 30,
      run_type: 'Easy Run',
    },
  });

  const goal = await request(baseUrl, '/goals', {
    method: 'POST',
    token,
    body: {
      goal_type: 'distance',
      target_distance: 8,
      target_duration_minutes: 55,
      target_date: addDays(toDateKey(), 21),
    },
  });

  const plan = await request(baseUrl, '/training-plans/generate', {
    method: 'POST',
    token,
    body: { goal_id: goal.data.goal.goal_id },
  });
  const session = plan.data.plan.sessions[0];

  const impossibleFail = await request(baseUrl, `/training-sessions/${session.training_session_id}/fail`, {
    method: 'POST',
    token,
    body: {
      actual_distance: Number(session.target_distance),
      actual_duration_minutes: session.target_duration_minutes,
      failure_reason: 'ลองส่งผิด',
    },
  });
  assert.equal(impossibleFail.response.status, 422);
  assert.match(impossibleFail.data.error.message, /ถึงเป้า/);

  const completed = await request(baseUrl, `/training-sessions/${session.training_session_id}/submit`, {
    method: 'POST',
    token,
    body: {
      actual_distance: Number(session.target_distance),
      actual_duration_minutes: session.target_duration_minutes,
    },
  });
  assert.equal(completed.response.status, 201);
  assert.equal(completed.data.progress.status, 'completed');
  assert.equal(completed.data.run.source, 'quest');

  const duplicateComplete = await request(baseUrl, `/training-sessions/${session.training_session_id}/submit`, {
    method: 'POST',
    token,
    body: {
      actual_distance: Number(session.target_distance),
      actual_duration_minutes: session.target_duration_minutes,
    },
  });
  assert.equal(duplicateComplete.response.status, 409);
});

test('rejects a pending AI plan adjustment without changing the active plan version', async (t) => {
  store.resetForTests();
  authProvider.resetForTests();
  const server = await listen(app);
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api`;

  await request(baseUrl, '/auth/register', {
    method: 'POST',
    body: {
      email: 'adjustment-reject@example.com',
      password: 'password123',
    },
  });

  const login = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: {
      email: 'adjustment-reject@example.com',
      password: 'password123',
    },
  });
  const { token } = login.data;

  await request(baseUrl, '/me', {
    method: 'PUT',
    token,
    body: {
      name: 'Reject Runner',
      age: 24,
      weight: 68,
      height: 176,
      experience_level: 'beginner',
    },
  });

  await request(baseUrl, '/runs', {
    method: 'POST',
    token,
    body: {
      run_date: toDateKey(),
      distance: 3,
      duration_minutes: 25,
      run_type: 'Easy Run',
    },
  });

  const goal = await request(baseUrl, '/goals', {
    method: 'POST',
    token,
    body: {
      goal_type: 'distance',
      target_distance: 7,
      target_duration_minutes: 50,
      target_date: addDays(toDateKey(), 21),
    },
  });

  const plan = await request(baseUrl, '/training-plans/generate', {
    method: 'POST',
    token,
    body: { goal_id: goal.data.goal.goal_id },
  });
  const session = plan.data.plan.sessions[0];

  const failed = await request(baseUrl, `/training-sessions/${session.training_session_id}/fail`, {
    method: 'POST',
    token,
    body: {
      actual_distance: Number(session.target_distance) - 0.5,
      actual_duration_minutes: session.target_duration_minutes,
      failure_reason: 'ตั้งใจทดสอบ reject flow',
    },
  });
  assert.equal(failed.response.status, 201);
  assert.equal(failed.data.pending_adjustment.status, 'pending');

  const rejected = await request(
    baseUrl,
    `/training-plans/adjustments/${failed.data.pending_adjustment.plan_adjustment_id}/reject`,
    { method: 'POST', token },
  );
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.data.adjustment.status, 'rejected');
  assert.equal(rejected.data.plan.version, 1);
  assert.equal(rejected.data.plan.pending_adjustment, null);

  const acceptRejected = await request(
    baseUrl,
    `/training-plans/adjustments/${failed.data.pending_adjustment.plan_adjustment_id}/accept`,
    { method: 'POST', token },
  );
  assert.equal(acceptRejected.response.status, 409);
});

test('rejects invalid sprint 1 profile, run, and goal input', async (t) => {
  store.resetForTests();
  authProvider.resetForTests();
  const server = await listen(app);
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api`;

  await request(baseUrl, '/auth/register', {
    method: 'POST',
    body: {
      email: 'validation-runner@example.com',
      password: 'password123',
    },
  });

  const login = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: {
      email: 'validation-runner@example.com',
      password: 'password123',
    },
  });
  assert.equal(login.response.status, 200);
  const { token } = login.data;

  const invalidProfile = await request(baseUrl, '/me', {
    method: 'PUT',
    token,
    body: {
      name: 'Validation Runner',
      age: 9,
      weight: 64,
      height: 172,
      experience_level: 'beginner',
    },
  });
  assert.equal(invalidProfile.response.status, 400);
  assert.match(invalidProfile.data.error.message, /อายุ/);

  const validProfile = await request(baseUrl, '/me', {
    method: 'PUT',
    token,
    body: {
      name: 'Validation Runner',
      age: 20,
      weight: 64,
      height: 172,
      experience_level: 'beginner',
    },
  });
  assert.equal(validProfile.response.status, 200);

  const futureRun = await request(baseUrl, '/runs', {
    method: 'POST',
    token,
    body: {
      run_date: addDays(toDateKey(), 1),
      distance: 3,
      duration_minutes: 24,
      run_type: 'Easy Run',
    },
  });
  assert.equal(futureRun.response.status, 400);
  assert.match(futureRun.data.error.message, /อนาคต/);

  const invalidRunType = await request(baseUrl, '/runs', {
    method: 'POST',
    token,
    body: {
      run_date: toDateKey(),
      distance: 3,
      duration_minutes: 24,
      run_type: 'Sprint',
    },
  });
  assert.equal(invalidRunType.response.status, 400);
  assert.match(invalidRunType.data.error.message, /ประเภทการวิ่ง/);

  const validRun = await request(baseUrl, '/runs', {
    method: 'POST',
    token,
    body: {
      run_date: toDateKey(),
      distance: 3,
      duration_minutes: 24,
      run_type: 'Easy Run',
    },
  });
  assert.equal(validRun.response.status, 201);

  const todayGoal = await request(baseUrl, '/goals', {
    method: 'POST',
    token,
    body: {
      goal_type: 'distance',
      target_distance: 5,
      target_duration_minutes: 35,
      target_date: toDateKey(),
    },
  });
  assert.equal(todayGoal.response.status, 400);
  assert.match(todayGoal.data.error.message, /อนาคต/);
});
