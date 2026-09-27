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

function isMissingRpcError(error) {
  return error?.details?.code === 'PGRST202'
    || /function.*get_runai_dashboard|Could not find.*get_runai_dashboard/i.test(error?.message || '');
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

function listRunsForUser(userId, options = {}) {
  return selectRows('runs', [['user_id', 'eq', userId]], {
    order: 'run_date.desc,run_id.desc',
    limit: options.limit || null,
  });
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

async function listProgressForSessionIds(sessionIds) {
  const ids = [...new Set(sessionIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return [];

  return selectRows('training_progress', [
    ['training_session_id', 'in', `(${ids.join(',')})`],
  ]);
}

async function refreshPlanState(plan, preloadedSessions = null) {
  const today = toDateKey();
  const sessions = preloadedSessions || await getPlanSessions(plan.training_plan_id);
  const progressRows = await listProgressForSessionIds(
    sessions.map((session) => session.training_session_id),
  );
  const progressBySessionId = new Map(
    progressRows.map((progress) => [Number(progress.training_session_id), progress]),
  );
  const refreshedSessions = [];

  for (const session of sessions) {
    const progress = progressBySessionId.get(Number(session.training_session_id));

    if (progress) {
      if (session.status !== progress.status) {
        const updatedSession = await updateRecord('training_sessions', session.training_session_id, {
          status: progress.status,
        });
        refreshedSessions.push(updatedSession || { ...session, status: progress.status });
      } else {
        refreshedSessions.push(session);
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
      const updatedSession = await updateRecord('training_sessions', session.training_session_id, {
        status: 'expired',
      });
      refreshedSessions.push(updatedSession || { ...session, status: 'expired' });
      continue;
    }

    const nextStatus = compareDateKey(session.session_date, today) > 0 ? 'locked' : 'available';
    if (session.status !== nextStatus) {
      const updatedSession = await updateRecord('training_sessions', session.training_session_id, {
        status: nextStatus,
      });
      refreshedSessions.push(updatedSession || { ...session, status: nextStatus });
      continue;
    }

    refreshedSessions.push(session);
  }

  return refreshedSessions;
}

async function findActivePlan(userId, options = {}) {
  const plan = await selectOne('training_plans', [
    ['user_id', 'eq', userId],
    ['status', 'eq', 'active'],
  ]);

  if (plan && options.refresh !== false) {
    await refreshPlanState(plan);
  }

  return plan;
}

function getWeekRange() {
  const today = new Date();
  const dayIndex = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - dayIndex);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: toDateKey(start),
    end: toDateKey(end),
  };
}

function summarizeRuns(runs) {
  const week = getWeekRange();
  const totalDistance = runs.reduce((sum, run) => sum + Number(run.distance || 0), 0);
  const totalDuration = runs.reduce((sum, run) => sum + Number(run.duration_minutes || 0), 0);
  const weeklyDistance = runs
    .filter((run) => run.run_date >= week.start && run.run_date <= week.end)
    .reduce((sum, run) => sum + Number(run.distance || 0), 0);

  return {
    total_count: runs.length,
    total_distance: totalDistance,
    total_duration_minutes: totalDuration,
    weekly_distance: weeklyDistance,
    week_start: week.start,
    week_end: week.end,
  };
}

function normalizeDashboardPayload(user, payload) {
  const data = Array.isArray(payload) ? payload[0] : payload;
  const week = getWeekRange();

  return {
    user: publicUser(user),
    goals: data?.goals || [],
    runs: data?.runs || [],
    run_summary: data?.run_summary || {
      total_count: 0,
      total_distance: 0,
      total_duration_minutes: 0,
      weekly_distance: 0,
      week_start: week.start,
      week_end: week.end,
    },
    active_plan: data?.active_plan || null,
  };
}

async function getDashboardDataFallback(user, options = {}) {
  const recentRunLimit = Number(options.recentRunLimit || 16);
  const allRuns = await listRunsForUser(user.user_id);
  const activePlan = await findActivePlan(user.user_id, { refresh: false });

  return {
    user: publicUser(user),
    goals: await listGoalsForUser(user.user_id),
    runs: allRuns.slice(0, recentRunLimit),
    run_summary: summarizeRuns(allRuns),
    active_plan: activePlan ? await serializePlan(activePlan, { refresh: false }) : null,
  };
}

async function getDashboardData(user, options = {}) {
  const recentRunLimit = Number(options.recentRunLimit || 16);

  try {
    const payload = await supabaseFetch('rpc/get_runai_dashboard', {
      method: 'POST',
      body: {
        requested_user_id: user.user_id,
        recent_run_limit: recentRunLimit,
      },
    });

    return normalizeDashboardPayload(user, payload);
  } catch (error) {
    if (!isMissingRpcError(error)) {
      throw error;
    }

    return getDashboardDataFallback(user, options);
  }
}

function buildPlanCalendar(plan, sessions) {
  const byDate = new Map(sessions.map((session) => [session.session_date, session]));

  return eachDate(plan.start_date, plan.end_date).map((date) => ({
    date,
    session: byDate.get(date) || null,
    note: byDate.has(date) ? null : 'วันนี้ไม่มีเควส',
  }));
}

async function getPlanCalendar(plan) {
  return buildPlanCalendar(plan, await getPlanSessions(plan.training_plan_id));
}

async function serializePlan(plan, options = {}) {
  const sessions = options.refresh === false
    ? await getPlanSessions(plan.training_plan_id)
    : await refreshPlanState(plan);
  const pendingAdjustment = await findPendingAdjustmentForPlan(plan.training_plan_id);

  return {
    ...plan,
    sessions,
    calendar: buildPlanCalendar(plan, sessions),
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

function findPendingAdjustmentForPlan(planId) {
  return selectOne('plan_adjustments', [
    ['training_plan_id', 'eq', planId],
    ['status', 'eq', 'pending'],
  ], { order: 'created_at.desc' });
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
  findPendingAdjustmentForPlan,
  findPlanById,
  findPlanForUser,
  findProgressBySessionId,
  findSessionForUser,
  findUserByEmail,
  findUserById,
  getDashboardData,
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
