const { compareDateKey, eachDate, toDateKey } = require('../utils/dates');

const db = {
  profiles: [],
  goals: [],
  runs: [],
  training_plans: [],
  training_sessions: [],
  training_progress: [],
  ai_analysis: [],
  plan_adjustments: [],
};

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

const counters = Object.fromEntries(Object.keys(db).map((table) => [table, 1]));

function createRecord(table, attrs) {
  const idName = idNames[table];
  const now = new Date().toISOString();
  const idValue = attrs[idName] !== undefined ? attrs[idName] : counters[table]++;
  const record = {
    [idName]: idValue,
    ...attrs,
    created_at: now,
    updated_at: now,
  };

  db[table].push(record);
  return record;
}

function touch(record) {
  record.updated_at = new Date().toISOString();
  return record;
}

function publicUser(user) {
  if (!user) return null;
  return { ...user };
}

function sameUserId(left, right) {
  return String(left) === String(right);
}

function findUserById(userId) {
  return db.profiles.find((user) => sameUserId(user.user_id, userId)) || null;
}

function findUserByEmail(email) {
  return db.profiles.find((user) => user.email.toLowerCase() === String(email).toLowerCase()) || null;
}

function listGoalsForUser(userId) {
  return db.goals
    .filter((goal) => sameUserId(goal.user_id, userId))
    .sort((a, b) => b.goal_id - a.goal_id);
}

function findGoalForUser(userId, goalId) {
  return db.goals.find(
    (goal) => goal.goal_id === Number(goalId) && sameUserId(goal.user_id, userId),
  ) || null;
}

function findGoalById(goalId) {
  return db.goals.find((goal) => goal.goal_id === Number(goalId)) || null;
}

function findActiveGoal(userId, goalId = null) {
  const goals = db.goals
    .filter((goal) => sameUserId(goal.user_id, userId) && goal.status === 'active')
    .sort((a, b) => b.goal_id - a.goal_id);

  if (goalId) {
    return goals.find((goal) => goal.goal_id === Number(goalId));
  }

  return goals[0] || null;
}

function listRunsForUser(userId) {
  return db.runs
    .filter((run) => sameUserId(run.user_id, userId))
    .sort((a, b) => b.run_date.localeCompare(a.run_date));
}

function findActivePlan(userId) {
  const plan = db.training_plans.find(
    (item) => sameUserId(item.user_id, userId) && item.status === 'active',
  );

  if (plan) {
    refreshPlanState(plan);
  }

  return plan || null;
}

function findPlanById(planId) {
  return db.training_plans.find(
    (plan) => plan.training_plan_id === Number(planId),
  ) || null;
}

function findPlanForUser(userId, planId) {
  return db.training_plans.find(
    (plan) => plan.training_plan_id === Number(planId) && sameUserId(plan.user_id, userId),
  ) || null;
}

function getPlanSessions(planId) {
  return db.training_sessions
    .filter((session) => session.training_plan_id === Number(planId))
    .sort((a, b) => compareDateKey(a.session_date, b.session_date));
}

function getPlanCalendar(plan) {
  const sessions = getPlanSessions(plan.training_plan_id);
  const byDate = new Map(sessions.map((session) => [session.session_date, session]));

  return eachDate(plan.start_date, plan.end_date).map((date) => ({
    date,
    session: byDate.get(date) || null,
    note: byDate.has(date) ? null : 'วันนี้ไม่มีเควส',
  }));
}

function findSessionForUser(userId, sessionId) {
  const session = db.training_sessions.find(
    (item) => item.training_session_id === Number(sessionId),
  );
  if (!session) return null;

  const plan = db.training_plans.find(
    (item) => item.training_plan_id === session.training_plan_id && sameUserId(item.user_id, userId),
  );

  if (!plan) return null;
  refreshPlanState(plan);
  return session;
}

function findProgressBySessionId(sessionId) {
  return db.training_progress.find(
    (progress) => progress.training_session_id === Number(sessionId),
  );
}

function hasAnalysisForFailedSession(planId, sessionId) {
  return db.ai_analysis.some((analysis) => (
    analysis.training_plan_id === Number(planId)
    && analysis.result_json
    && Number(analysis.result_json.failed_session_id) === Number(sessionId)
  ));
}

function findAdjustmentById(adjustmentId) {
  return db.plan_adjustments.find(
    (adjustment) => adjustment.plan_adjustment_id === Number(adjustmentId),
  ) || null;
}

function updateRecord(table, idValue, attrs) {
  const idName = idNames[table];
  const record = db[table].find((item) => (
    table === 'profiles'
      ? sameUserId(item[idName], idValue)
      : item[idName] === Number(idValue)
  ));

  if (!record) return null;

  Object.assign(record, attrs);
  return touch(record);
}

function createRecords(table, records) {
  return records.map((record) => createRecord(table, record));
}

function deleteFutureSessions(planId, afterDate) {
  const originalLength = db.training_sessions.length;
  db.training_sessions = db.training_sessions.filter((session) => (
    session.training_plan_id !== Number(planId)
    || compareDateKey(session.session_date, afterDate) <= 0
  ));
  return originalLength - db.training_sessions.length;
}

function refreshPlanState(plan) {
  const today = toDateKey();
  const sessions = getPlanSessions(plan.training_plan_id);

  for (const session of sessions) {
    const progress = findProgressBySessionId(session.training_session_id);

    if (progress) {
      session.status = progress.status;
      touch(session);
      continue;
    }

    if (compareDateKey(session.session_date, today) < 0) {
      createRecord('training_progress', {
        training_session_id: session.training_session_id,
        run_id: null,
        status: 'expired',
        actual_distance: null,
        actual_duration_minutes: null,
        failure_reason: null,
        submitted_at: new Date(`${session.session_date}T23:59:00`).toISOString(),
        strava_image_url: null,
      });
      session.status = 'expired';
      touch(session);
      continue;
    }

    if (compareDateKey(session.session_date, today) > 0) {
      session.status = 'locked';
      touch(session);
      continue;
    }

    session.status = 'available';
    touch(session);
  }
}

function serializePlan(plan) {
  refreshPlanState(plan);
  return {
    ...plan,
    sessions: getPlanSessions(plan.training_plan_id),
    calendar: getPlanCalendar(plan),
    pending_adjustment: db.plan_adjustments.find(
      (adjustment) => adjustment.training_plan_id === plan.training_plan_id
        && adjustment.status === 'pending',
    ) || null,
  };
}

function resetForTests() {
  for (const table of Object.keys(db)) {
    db[table].length = 0;
    counters[table] = 1;
  }
}

module.exports = {
  createRecords,
  createRecord,
  db,
  deleteFutureSessions,
  findAdjustmentById,
  findActiveGoal,
  findActivePlan,
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
  touch,
  updateRecord,
};
