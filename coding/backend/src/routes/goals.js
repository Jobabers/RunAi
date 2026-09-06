const express = require('express');
const store = require('../storage');
const { assertCondition, HttpError } = require('../utils/httpError');

const router = express.Router();

function isProfileComplete(user) {
  return Boolean(user?.name && user?.age && user?.weight && user?.height && user?.experience_level);
}

router.get('/goals', async (req, res, next) => {
  try {
    const goals = await store.listGoalsForUser(req.user.user_id);
    res.json({ goals });
  } catch (err) {
    next(err);
  }
});

router.post('/goals', async (req, res, next) => {
  try {
    const {
      goal_type,
      target_distance,
      target_duration_minutes,
      target_date,
    } = req.body;

    assertCondition(goal_type, 400, 'กรุณาระบุประเภทเป้าหมาย');
    assertCondition(Number(target_distance) > 0, 400, 'ระยะทางเป้าหมายต้องมากกว่า 0');
    assertCondition(target_date, 400, 'กรุณาระบุวันที่ต้องการบรรลุเป้าหมาย');
    assertCondition(isProfileComplete(req.user), 400, 'กรุณากรอกข้อมูล Profile ให้ครบก่อนสร้าง Goal');

    const runs = await store.listRunsForUser(req.user.user_id);
    assertCondition(runs.length >= 1, 400, 'ต้องมีประวัติการวิ่งอย่างน้อย 1 รายการก่อนสร้าง Goal');

    const goal = await store.createRecord('goals', {
      user_id: req.user.user_id,
      goal_type: String(goal_type),
      target_distance: Number(target_distance),
      target_duration_minutes: target_duration_minutes ? Number(target_duration_minutes) : null,
      target_date,
      status: 'active',
    });

    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
});

router.patch('/goals/:goalId/complete', async (req, res, next) => {
  try {
    const goal = await store.findGoalForUser(req.user.user_id, req.params.goalId);

    if (!goal) {
      throw new HttpError(404, 'ไม่พบเป้าหมาย');
    }

    const completedGoal = await store.updateRecord('goals', goal.goal_id, { status: 'completed' });

    let plan = await store.findActivePlan(req.user.user_id);
    if (plan && Number(plan.goal_id) === Number(goal.goal_id)) {
      plan = await store.updateRecord('training_plans', plan.training_plan_id, {
        status: 'completed',
      });
    }

    res.json({ goal: completedGoal, active_plan: plan || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
