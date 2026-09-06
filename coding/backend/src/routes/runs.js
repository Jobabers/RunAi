const express = require('express');
const store = require('../storage');
const { assertCondition } = require('../utils/httpError');

const router = express.Router();

function validateRunInput(body) {
  assertCondition(body.run_date, 400, 'กรุณาระบุวันที่วิ่ง');
  assertCondition(Number(body.distance) > 0, 400, 'ระยะทางต้องมากกว่า 0');
  assertCondition(Number(body.duration_minutes) > 0, 400, 'เวลาที่ใช้ต้องมากกว่า 0');
}

router.get('/runs', async (req, res, next) => {
  try {
    const runs = await store.listRunsForUser(req.user.user_id);
    res.json({ runs });
  } catch (err) {
    next(err);
  }
});

router.post('/runs', async (req, res, next) => {
  try {
    validateRunInput(req.body);

    const run = await store.createRecord('runs', {
      user_id: req.user.user_id,
      run_date: req.body.run_date,
      distance: Number(req.body.distance),
      duration_minutes: Number(req.body.duration_minutes),
      run_type: req.body.run_type || 'Easy Run',
      source: req.body.source || 'manual',
    });

    res.status(201).json({ run });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  router,
  validateRunInput,
};
