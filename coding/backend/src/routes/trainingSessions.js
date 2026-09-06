const express = require('express');
const store = require('../storage');
const { createPendingAdjustment } = require('./trainingPlans');
const { toDateKey } = require('../utils/dates');
const { assertCondition, HttpError } = require('../utils/httpError');

const router = express.Router();

function createRunFromQuest(userId, body, session) {
  return store.createRecord('runs', {
    user_id: userId,
    run_date: toDateKey(),
    distance: Number(body.actual_distance),
    duration_minutes: Number(body.actual_duration_minutes),
    run_type: session.training_type,
    source: 'quest',
  });
}

async function assertSubmittable(session) {
  assertCondition(session.status === 'available', 409, 'เควสนี้ยังไม่เปิดให้ส่งผล');
  assertCondition(!(await store.findProgressBySessionId(session.training_session_id)), 409, 'เควสนี้ถูกส่งผลแล้ว ไม่สามารถแก้ไขผลการส่งได้');
}

router.post('/training-sessions/:sessionId/submit', async (req, res, next) => {
  try {
    const session = await store.findSessionForUser(req.user.user_id, req.params.sessionId);
    if (!session) {
      throw new HttpError(404, 'ไม่พบเควส');
    }

    await assertSubmittable(session);
    assertCondition(Number(req.body.actual_distance) > 0, 400, 'กรุณาระบุระยะทางจริง');
    assertCondition(Number(req.body.actual_duration_minutes) > 0, 400, 'กรุณาระบุเวลาที่ใช้จริง');

    if (Number(req.body.actual_distance) < Number(session.target_distance)) {
      throw new HttpError(422, 'เควสยังไม่ผ่าน', {
        can_fail: true,
        target_distance: session.target_distance,
        actual_distance: Number(req.body.actual_distance),
      });
    }

    const run = await createRunFromQuest(req.user.user_id, req.body, session);
    const progress = await store.createRecord('training_progress', {
      training_session_id: session.training_session_id,
      run_id: run.run_id,
      status: 'completed',
      actual_distance: Number(req.body.actual_distance),
      actual_duration_minutes: Number(req.body.actual_duration_minutes),
      failure_reason: null,
      submitted_at: new Date().toISOString(),
      strava_image_url: req.body.strava_image_url || null,
    });

    const completedSession = await store.updateRecord('training_sessions', session.training_session_id, {
      status: 'completed',
    });

    res.status(201).json({ session: completedSession, progress, run });
  } catch (err) {
    next(err);
  }
});

router.post('/training-sessions/:sessionId/fail', async (req, res, next) => {
  try {
    const session = await store.findSessionForUser(req.user.user_id, req.params.sessionId);
    if (!session) {
      throw new HttpError(404, 'ไม่พบเควส');
    }

    await assertSubmittable(session);
    assertCondition(req.body.failure_reason, 400, 'กรุณาระบุเหตุผลที่ทำเควสไม่สำเร็จ');

    let run = null;
    if (req.body.actual_distance && req.body.actual_duration_minutes) {
      run = await createRunFromQuest(req.user.user_id, req.body, session);
    }

    const progress = await store.createRecord('training_progress', {
      training_session_id: session.training_session_id,
      run_id: run ? run.run_id : null,
      status: 'failed',
      actual_distance: req.body.actual_distance ? Number(req.body.actual_distance) : null,
      actual_duration_minutes: req.body.actual_duration_minutes ? Number(req.body.actual_duration_minutes) : null,
      failure_reason: String(req.body.failure_reason),
      submitted_at: new Date().toISOString(),
      strava_image_url: req.body.strava_image_url || null,
    });

    const failedSession = await store.updateRecord('training_sessions', session.training_session_id, {
      status: 'failed',
    });

    const plan = await store.findPlanForUser(req.user.user_id, session.training_plan_id);
    const adjustment = await createPendingAdjustment({
      user: req.user,
      plan,
      failedSession,
      reason: progress.failure_reason,
    });

    res.status(201).json({ session: failedSession, progress, run, pending_adjustment: adjustment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
