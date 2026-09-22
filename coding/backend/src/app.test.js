const test = require('node:test');
const assert = require('node:assert/strict');

process.env.STORAGE_DRIVER = 'memory';

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
