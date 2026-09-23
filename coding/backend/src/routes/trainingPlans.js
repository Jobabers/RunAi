const express = require('express');
const store = require('../storage');
const {
  adjustFutureSessions,
  createTrainingSessions,
} = require('../services/trainingPlanner');
const { adjustPlan, createInitialPlan } = require('../services/aiCoach');
const { compareDateKey, toDateKey } = require('../utils/dates');
const { assertCondition, HttpError } = require('../utils/httpError');

const router = express.Router();

function isProfileComplete(user) {
  return Boolean(user?.name && user?.age && user?.weight && user?.height && user?.experience_level);
}

function hasAdjustmentForSession(plan, session) {
  return store.hasAnalysisForFailedSession(plan.training_plan_id, session.training_session_id);
}

async function createPendingAdjustment({ user, plan, failedSession, reason, triggerType = 'failed_quest' }) {
  const goal = await store.findGoalById(plan.goal_id);
  const runs = await store.listRunsForUser(user.user_id);
  const today = toDateKey();
  const futureSessions = (await store.getPlanSessions(plan.training_plan_id))
    .filter((session) => compareDateKey(session.session_date, today) > 0);
  const fallbackSessions = adjustFutureSessions({
    failedSession,
    futureSessions,
    goal,
    runs,
  });
  const aiAdjustment = await adjustPlan({
    user,
    goal,
    runs,
    failedSession,
    futureSessions,
    reason,
    fallbackSessions,
    triggerType,
  });

  const analysis = await store.createRecord('ai_analysis', {
    user_id: user.user_id,
    training_plan_id: plan.training_plan_id,
    trigger_type: triggerType,
    result_json: {
      summary: aiAdjustment.summary,
      recommendation: aiAdjustment.recommendation,
      source: aiAdjustment.source,
      enabled: aiAdjustment.enabled,
      failed_session_id: failedSession.training_session_id,
      reason,
      fallback_reason: aiAdjustment.reason || null,
    },
  });

  return store.createRecord('plan_adjustments', {
    training_plan_id: plan.training_plan_id,
    ai_analysis_id: analysis.ai_analysis_id,
    reason,
    status: 'pending',
    proposed_sessions: aiAdjustment.sessions,
  });
}

async function ensureExpiredAdjustments(user, plan) {
  const sessions = await store.getPlanSessions(plan.training_plan_id);
  let expiredSession = null;

  for (const session of sessions) {
    if (session.status === 'expired' && !(await hasAdjustmentForSession(plan, session))) {
      expiredSession = session;
      break;
    }
  }

  if (!expiredSession) return null;

  return createPendingAdjustment({
    user,
    plan,
    failedSession: expiredSession,
    reason: 'Quest expired at 23:59',
    triggerType: 'expired_quest',
  });
}

router.get('/training-plans/active', async (req, res, next) => {
  try {
    const plan = await store.findActivePlan(req.user.user_id);
    if (plan) {
      await ensureExpiredAdjustments(req.user, plan);
    }

    res.json({ plan: plan ? await store.serializePlan(plan) : null });
  } catch (err) {
    next(err);
  }
});

router.post('/training-plans/generate', async (req, res, next) => {
  try {
    assertCondition(!(await store.findActivePlan(req.user.user_id)), 409, 'ผู้ใช้งานมีตารางการฝึกที่กำลังใช้งานอยู่แล้ว');
    assertCondition(isProfileComplete(req.user), 400, 'กรุณากรอกข้อมูล Profile ให้ครบก่อนสร้างตารางการฝึก');

    const runs = await store.listRunsForUser(req.user.user_id);
    assertCondition(runs.length >= 1, 400, 'ต้องมีประวัติการวิ่งอย่างน้อย 1 รายการก่อนสร้างตารางการฝึก');

    const goal = await store.findActiveGoal(req.user.user_id, req.body.goal_id);
    assertCondition(goal, 400, 'กรุณาสร้างหรือเลือกเป้าหมายที่กำลังใช้งานก่อน');

    const startDate = req.body.start_date || toDateKey();
    const requestedEndDate = req.body.end_date || goal.target_date;
    const weeks = req.body.weeks ? Number(req.body.weeks) : undefined;
    const fallbackSessions = createTrainingSessions({
      startDate,
      endDate: weeks ? null : requestedEndDate,
      weeks: weeks || 2,
      goal,
      runs,
    });
    const aiPlan = await createInitialPlan({
      user: req.user,
      goal,
      runs,
      startDate,
      endDate: weeks ? fallbackSessions[fallbackSessions.length - 1].session_date : requestedEndDate,
      fallbackSessions,
    });
    const generatedSessions = aiPlan.sessions;
    const endDate = weeks
      ? generatedSessions[generatedSessions.length - 1].session_date
      : requestedEndDate;

    const plan = await store.createRecord('training_plans', {
      user_id: req.user.user_id,
      goal_id: goal.goal_id,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
      version: 1,
      source: aiPlan.source,
    });

    await store.createRecords(
      'training_sessions',
      generatedSessions.map((session) => ({
        training_plan_id: plan.training_plan_id,
        ...session,
      })),
    );

    const analysis = await store.createRecord('ai_analysis', {
      user_id: req.user.user_id,
      training_plan_id: plan.training_plan_id,
      trigger_type: 'initial_plan',
      result_json: {
        summary: aiPlan.summary,
        recommendation: aiPlan.recommendation,
        source: aiPlan.source,
        enabled: aiPlan.enabled,
        fallback_reason: aiPlan.reason || null,
      },
    });

    res.status(201).json({
      plan: await store.serializePlan(plan),
      ai_analysis: analysis,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/training-plans/adjustments/:adjustmentId/accept', async (req, res, next) => {
  try {
    const adjustment = await store.findAdjustmentById(req.params.adjustmentId);

    if (!adjustment) {
      throw new HttpError(404, 'ไม่พบแผนที่ AI ปรับให้');
    }

    const plan = await store.findPlanForUser(req.user.user_id, adjustment.training_plan_id);

    if (!plan) {
      throw new HttpError(404, 'ไม่พบตารางการฝึก');
    }

    assertCondition(adjustment.status === 'pending', 409, 'แผนนี้ถูกดำเนินการแล้ว');

    const today = toDateKey();
    await store.deleteFutureSessions(plan.training_plan_id, today);

    await store.createRecords(
      'training_sessions',
      adjustment.proposed_sessions.map((session) => ({
        training_plan_id: plan.training_plan_id,
        session_date: session.session_date,
        training_type: session.training_type,
        target_distance: session.target_distance,
        target_duration_minutes: session.target_duration_minutes,
        status: session.status,
        note: session.note,
      })),
    );

    const planUpdates = {
      version: Number(plan.version) + 1,
    };
    if (adjustment.proposed_sessions.length > 0) {
      planUpdates.end_date = adjustment.proposed_sessions[adjustment.proposed_sessions.length - 1].session_date;
    }

    const updatedPlan = await store.updateRecord('training_plans', plan.training_plan_id, planUpdates);
    const updatedAdjustment = await store.updateRecord('plan_adjustments', adjustment.plan_adjustment_id, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });

    res.json({
      plan: await store.serializePlan(updatedPlan),
      adjustment: updatedAdjustment,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  createPendingAdjustment,
  router,
};
