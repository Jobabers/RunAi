const cors = require('cors');
const express = require('express');
const config = require('./config');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const goalRoutes = require('./routes/goals');
const { router: runRoutes } = require('./routes/runs');
const { router: trainingPlanRoutes } = require('./routes/trainingPlans');
const trainingSessionRoutes = require('./routes/trainingSessions');
const { requireAuth } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errors');

const app = express();

app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RunAI API',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, profileRoutes);
app.use('/api', requireAuth, goalRoutes);
app.use('/api', requireAuth, runRoutes);
app.use('/api', requireAuth, trainingPlanRoutes);
app.use('/api', requireAuth, trainingSessionRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
