const express = require('express');
const store = require('../storage');
const { queueExpiredAdjustmentCheck } = require('./trainingPlans');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboard = await store.getDashboardData(req.user, {
      recentRunLimit: 16,
    });

    res.json(dashboard);

    if (dashboard.active_plan) {
      queueExpiredAdjustmentCheck(req.user, dashboard.active_plan);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
