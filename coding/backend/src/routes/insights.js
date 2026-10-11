const express = require('express');
const store = require('../storage');
const { analyzeProgress } = require('../services/aiCoach');
const { progressMetrics } = require('../services/progressMetrics');
const { assertCondition, HttpError } = require('../utils/httpError');
const router = express.Router();
const inFlight = new Set();

router.get('/plan-history', async (req, res, next) => {
  try {
    const analyses = await store.listAnalysesForUser(req.user.user_id);
    const ids = [...new Set(analyses.map((row) => row.training_plan_id))];
    const rows = [];
    for (const id of ids) {
      if (!await store.findPlanForUser(req.user.user_id, id)) continue;
      rows.push(...await store.listAdjustmentsForPlan(id));
    }
    res.json({ adjustments: rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((row) => ({
      ...row, analysis: analyses.find((item) => item.ai_analysis_id === row.ai_analysis_id)?.result_json || null,
    })) });
  } catch (error) { next(error); }
});

router.get('/insights', async (req, res, next) => {
  try {
    const analyses = await store.listAnalysesForUser(req.user.user_id);
    const runs = await store.listRunsForUser(req.user.user_id);
    res.json({ analysis: analyses.find((row) => row.trigger_type === 'progress_review') || null, metrics: progressMetrics(runs) });
  } catch (error) { next(error); }
});

router.post('/insights', async (req, res, next) => {
  const userId = req.user.user_id;
  if (inFlight.has(userId)) return next(new HttpError(409, 'กำลังวิเคราะห์ข้อมูล กรุณารอสักครู่'));
  inFlight.add(userId);
  try {
    const goal = await store.findActiveGoal(userId);
    const runs = await store.listRunsForUser(userId);
    const plan = await store.findActivePlan(userId);
    assertCondition(plan, 400, 'ต้องมีแผนการฝึกที่กำลังใช้งานก่อนวิเคราะห์');
    assertCondition(goal && runs.length, 400, 'ต้องมีเป้าหมายที่กำลังฝึกและผลการวิ่งก่อนวิเคราะห์');
    const metrics = progressMetrics(runs);
    const previous = (await store.listAnalysesForUser(userId)).find((row) => row.trigger_type === 'progress_review');
    if (previous?.result_json?.goal_id === goal.goal_id
      && JSON.stringify(previous.result_json.metrics) === JSON.stringify(metrics)) return res.json({ analysis: previous });
    let result;
    try { result = await analyzeProgress({ user: req.user, goal, runs, metrics }); }
    catch { throw new HttpError(503, 'วิเคราะห์ไม่สำเร็จ ผลการวิ่งยังอยู่ครบ กรุณาลองใหม่ภายหลัง'); }
    const analysis = await store.createRecord('ai_analysis', {
      user_id: userId, training_plan_id: plan.training_plan_id,
      trigger_type: 'progress_review', result_json: { ...result, goal_id: goal.goal_id },
    });
    res.status(201).json({ analysis });
  } catch (error) { next(error); }
  finally { inFlight.delete(userId); }
});

router.get('/training-plans/:planId/history', async (req, res, next) => {
  try {
    const plan = await store.findPlanForUser(req.user.user_id, req.params.planId);
    assertCondition(plan, 404, 'ไม่พบแผนการฝึก');
    const analyses = await store.listAnalysesForUser(req.user.user_id);
    const adjustments = await store.listAdjustmentsForPlan(plan.training_plan_id);
    res.json({ adjustments: adjustments.map((row) => ({ ...row, analysis: analyses.find((item) => item.ai_analysis_id === row.ai_analysis_id)?.result_json || null })) });
  } catch (error) { next(error); }
});

module.exports = router;
