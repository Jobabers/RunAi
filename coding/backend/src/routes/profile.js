const express = require('express');
const store = require('../storage');
const { assertCondition } = require('../utils/httpError');

const router = express.Router();

router.get('/me', (req, res) => {
  res.json({ user: store.publicUser(req.user) });
});

router.put('/me', async (req, res, next) => {
  try {
    const { name, age, weight, height, experience_level } = req.body;
    const updates = {};

    if (name !== undefined) {
      assertCondition(String(name).trim().length >= 2, 400, 'กรุณาระบุชื่ออย่างน้อย 2 ตัวอักษร');
      updates.name = String(name).trim();
    }

    if (age !== undefined) updates.age = Number(age);
    if (weight !== undefined) updates.weight = Number(weight);
    if (height !== undefined) updates.height = Number(height);
    if (experience_level !== undefined) updates.experience_level = String(experience_level);

    const user = await store.updateRecord('profiles', req.user.user_id, updates);
    res.json({ user: store.publicUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
