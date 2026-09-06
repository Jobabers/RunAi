const config = require('../config');
const { compareDateKey, eachDate, toDateKey } = require('../utils/dates');
const { HttpError } = require('../utils/httpError');

const idNames = {
  profiles: 'user_id',
  goals: 'goal_id',
  runs: 'run_id',
  training_plans: 'training_plan_id',
  training_sessions: 'training_session_id',
  training_progress: 'training_progress_id',
  ai_analysis: 'ai_analysis_id',
  plan_adjustments: 'plan_adjustment_id',
};

function publicUser(user) {
  if (!user) return null;
  return { ...user };
}

function requireSupabaseConfig() {
  if (!config.supabase.restUrl || !config.supabase.serviceRoleKey) {
    throw new HttpError(500, 'ยังไม่ได้ตั้งค่า Supabase สำหรับ backend');
  }
}

function restUrl(table, params = null) {
  const query = params ? `?${params.toString()}` : '';
  return `${config.supabase.restUrl}/${table}${query}`;
}

function addFilter(params, column, operator, value) {
  params.set(column, `${operator}.${value}`);
}

async function supabaseFetch(table, { method = 'GET', params = null, body = null, prefer = '' } = {}) {
  requireSupabaseConfig();

  const headers = {
    apikey: config.supabase.serviceRoleKey,
    Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(restUrl(table, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    if (data?.code === 'PGRST205') {
      throw new HttpError(503, 'ยังไม่ได้รัน Supabase schema ใหม่ กรุณาสร้างตาราง profiles ก่อน', data);
    }

    const message = data?.message || data?.error || 'เชื่อมต่อ Supabase ไม่สำเร็จ';
    throw new HttpError(500, message, data);
  }

  return data;
}

async function selectRows(table, filters = [], { order = '', limit = null } = {}) {
  const params = new URLSearchParams({ select: '*' });

  filters.forEach(([column, operator, value]) => addFilter(params, column, operator, value));
  if (order) params.set('order', order);
  if (limit) params.set('limit', String(limit));

  return supabaseFetch(table, { params });
}

async function selectOne(table, filters = [], options = {}) {
  const rows = await selectRows(table, filters, { ...options, limit: 1 });
  return rows[0] || null;
}

async function createRecord(table, attrs) {
  const rows = await supabaseFetch(table, {
    method: 'POST',
    body: attrs,
    prefer: 'return=representation',
  });

  return rows[0];
}

async function createRecords(table, records) {
  if (!records.length) return [];

  return supabaseFetch(table, {
    method: 'POST',
    body: records,
    prefer: 'return=representation',
  });
}

async function updateRecord(table, idValue, attrs) {
  const params = new URLSearchParams();
  addFilter(params, idNames[table], 'eq', idValue);

  const rows = await supabaseFetch(table, {
    method: 'PATCH',
    params,
    body: attrs,
    prefer: 'return=representation',
  });

  return rows[0] || null;
}

async function deleteFutureSessions(planId, afterDate) {
  const params = new URLSearchParams();
  addFilter(params, 'training_plan_id', 'eq', planId);
  addFilter(params, 'session_date', 'gt', afterDate);

  await supabaseFetch('training_sessions', { method: 'DELETE', params });
}

function findUserById(userId) {
  return selectOne('profiles', [['user_id', 'eq', userId]]);
}

function findUserByEmail(email) {
  return selectOne('profiles', [['email', 'eq', String(email).trim().toLowerCase()]]);
}

function listGoalsForUser(userId) {
  return selectRows('goals', [['user_id', 'eq', userId]], { order: 'goal_id.desc' });
}

function findGoalForUser(userId, goalId) {
  return selectOne('goals', [
    ['goal_id', 'eq', goalId],
    ['user_id', 'eq', userId],
  ]);
}

function findGoalById(goalId) {
  return selectOne('goals', [['goal_id', 'eq', goalId]]);
}

function findActiveGoal(userId, goalId = null) {
  const filters = [
    ['user_id', 'eq', userId],
    ['status', 'eq', 'active'],
  ];

  if (goalId) {
    filters.push(['goal_id', 'eq', goalId]);
  }

  return selectOne('goals', filters, { order: 'goal_id.desc' });
}

function listRunsForUser(userId) {
  return selectRows('runs', [['user_id', 'eq', userId]], { order: 'run_date.desc' });
}

function findPlanById(planId) {
  return selectOne('training_plans', [['training_plan_id', 'eq', planId]]);
}

function findPlanForUser(userId, planId) {
  return selectOne('training_plans', [
    ['training_plan_id', 'eq', planId],
    ['user_id', 'eq', userId],
  ]);
}

async function getPlanSessions(planId) {
  return selectRows('training_sessions', [['training_plan_id', 'eq', planId]], {
    order: 'session_date.asc',
  });
}

async function findProgressBySessionId(sessionId) {
  return selectOne('training_progress', [['training_session_id', 'eq', sessionId]]);
}

async function refreshPlanState(plan) {
  const today = toDateKey();
  const sessions = await getPlanSessions(plan.training_plan_id);

  for (const session of sessions) {
    const progress = await findProgressBySessionId(session.training_session_id);

    if (progress) {
      if (session.status !== progress.status) {
        await updateRecord('training_sessions', session.training_session_id, {
          status: progress.status,
        });
      }
      continue;
    }

    if (compareDateKey(session.session_date, today) < 0) {
      await createRecord('training_progress', {
        training_session_id: session.training_session_id,
        run_id: null,
        status: 'expired',
        actual_distance: null,
        actual_duration_minutes: null,
        failure_reason: null,
        submitted_at: new Date(`${session.session_date}T23:59:00`).toISOString(),
        strava_image_url: null,
      });
      await updateRecord('training_sessions', session.training_session_id, {
        status: 'expired',
      });
      continue;
    }

    const nextStatus = compareDateKey(session.session_date, today) > 0 ? 'locked' : 'available';
    if (session.status !== nextStatus) {
      await updateRecord('training_sessions', session.training_session_id, {
        status: nextStatus,
      });
    }
  }
}

async function findActivePlan(userId) {
  const plan = await selectOne('training_plans', [
    ['user_id', 'eq', userId],
    ['status', 'eq', 'active'],
  ]);

  if (plan) {
    await refreshPlanState(plan);
  }

  return plan;
}

async function getPlanCalendar(plan) {
  const sessions = await getPlanSessions(plan.training_plan_id);
  const byDate = new Map(sessions.map((session) => [session.session_date, session]));

  return eachDate(plan.start_date, plan.end_date).map((date) => ({
    date,
    session: byDate.get(date) || null,
    note: byDate.has(date) ? null : 'วันนี้ไม่มีเควส',
  }));
}

async function serializePlan(plan) {
  await refreshPlanState(plan);

  const sessions = await getPlanSessions(plan.training_plan_id);
  const pendingAdjustment = await selectOne('plan_adjustments', [
    ['training_plan_id', 'eq', plan.training_plan_id],
    ['status', 'eq', 'pending'],
  ]);

  return {
    ...plan,
    sessions,
    calendar: await getPlanCalendar(plan),
    pending_adjustment: pendingAdjustment,
  };
}

async function findSessionForUser(userId, sessionId) {
  const session = await selectOne('training_sessions', [['training_session_id', 'eq', sessionId]]);
  if (!session) return null;

  const plan = await findPlanForUser(userId, session.training_plan_id);
  if (!plan) return null;

  await refreshPlanState(plan);
  return selectOne('training_sessions', [['training_session_id', 'eq', sessionId]]);
}

async function hasAnalysisForFailedSession(planId, sessionId) {
  const analyses = await selectRows('ai_analysis', [['training_plan_id', 'eq', planId]]);
  return analyses.some((analysis) => (
    Number(analysis.result_json?.failed_session_id) === Number(sessionId)
  ));
}

function findAdjustmentById(adjustmentId) {
  return selectOne('plan_adjustments', [['plan_adjustment_id', 'eq', adjustmentId]]);
}

function resetForTests() {
  throw new Error('resetForTests is available only for memory storage');
}

module.exports = {
  createRecord,
  createRecords,
  deleteFutureSessions,
  findActiveGoal,
  findActivePlan,
  findAdjustmentById,
  findGoalById,
  findGoalForUser,
  findPlanById,
  findPlanForUser,
  findProgressBySessionId,
  findSessionForUser,
  findUserByEmail,
  findUserById,
  getPlanSessions,
  hasAnalysisForFailedSession,
  listGoalsForUser,
  listRunsForUser,
  publicUser,
  refreshPlanState,
  resetForTests,
  serializePlan,
  updateRecord,
};
