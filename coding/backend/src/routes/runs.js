const express = require('express');
const store = require('../storage');
const { compareDateKey, toDateKey } = require('../utils/dates');
const { assertCondition } = require('../utils/httpError');

const router = express.Router();

const allowedRunTypes = new Set([
  'Easy Run',
  'Long Run',
  'Tempo Run',
  'Recovery Run',
]);

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function validateRunInput(body) {
  assertCondition(body.run_date, 400, 'กรุณาระบุวันที่วิ่ง');
  assertCondition(isDateKey(body.run_date), 400, 'รูปแบบวันที่วิ่งไม่ถูกต้อง');
  assertCondition(compareDateKey(body.run_date, toDateKey()) <= 0, 400, 'วันที่วิ่งต้องไม่เป็นวันในอนาคต');

  const distance = Number(body.distance);
  const durationMinutes = Number(body.duration_minutes);
  const runType = body.run_type || 'Easy Run';

  assertCondition(Number.isFinite(distance) && distance > 0, 400, 'ระยะทางต้องมากกว่า 0');
  assertCondition(distance <= 300, 400, 'ระยะทางต้องไม่เกิน 300 km');
  assertCondition(Number.isFinite(durationMinutes) && durationMinutes > 0, 400, 'เวลาที่ใช้ต้องมากกว่า 0');
  assertCondition(durationMinutes <= 1440, 400, 'เวลาที่ใช้ต้องไม่เกิน 1440 นาที');
  assertCondition(allowedRunTypes.has(runType), 400, 'ประเภทการวิ่งไม่ถูกต้อง');
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
