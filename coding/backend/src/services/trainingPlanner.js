const { addDays, compareDateKey, toDateKey } = require('../utils/dates');

const TRAINING_TYPES = ['Easy Run', 'Tempo Run', 'Long Run'];

function minutesFromRun(run) {
  return Number(run.duration_minutes || run.run_time_minutes || 0);
}

function distanceFromRun(run) {
  return Number(run.distance || run.distance_km || 0);
}

function getBaselineDistance(runs) {
  if (!runs.length) return 2;

  const distances = runs
    .map(distanceFromRun)
    .filter((distance) => Number.isFinite(distance) && distance > 0);

  if (!distances.length) return 2;

  const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  const longest = Math.max(...distances);

  return Math.max(1, Math.min(longest, average * 1.15));
}

function clampDistance(distance, goal) {
  const target = Number(goal.target_distance || goal.target_distance_km || distance);
  const maxDistance = Number.isFinite(target) && target > 0 ? target : distance;
  return Number(Math.max(1, Math.min(distance, maxDistance)).toFixed(1));
}

function estimateDurationMinutes(distance, runs) {
  const paceSamples = runs
    .map((run) => {
      const duration = minutesFromRun(run);
      const distanceKm = distanceFromRun(run);
      return distanceKm > 0 && duration > 0 ? duration / distanceKm : null;
    })
    .filter(Boolean);

  const pace = paceSamples.length
    ? paceSamples.reduce((sum, item) => sum + item, 0) / paceSamples.length
    : 8;

  return Math.max(10, Math.round(distance * pace));
}

function getInclusiveDayCount(startDate, endDate) {
  if (!endDate || compareDateKey(endDate, startDate) < 0) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.floor((end - start) / dayMs) + 1;
}

function createTrainingSessions({
  startDate = toDateKey(),
  endDate = null,
  weeks = 2,
  goal,
  runs = [],
}) {
  const baseline = getBaselineDistance(runs);
  const sessions = [];
  const totalDays = getInclusiveDayCount(startDate, endDate) || weeks * 7;

  for (let day = 0; day < totalDays; day += 1) {
    const isRestDay = day % 3 === 1 || day % 7 === 6;
    if (isRestDay) continue;

    const type = TRAINING_TYPES[sessions.length % TRAINING_TYPES.length];
    const progression = 1 + sessions.length * 0.08;
    const targetDistance = clampDistance(baseline * progression, goal);

    sessions.push({
      session_date: addDays(startDate, day),
      training_type: type,
      target_distance: targetDistance,
      target_duration_minutes: estimateDurationMinutes(targetDistance, runs),
      status: day === 0 ? 'available' : 'locked',
      note: type === 'Long Run'
        ? 'เพิ่มระยะอย่างระมัดระวังและคุมความหนัก'
        : 'ฝึกตามเป้าหมายโดยใช้ระยะทางเป็นเกณฑ์หลัก',
    });
  }

  return sessions;
}

function adjustFutureSessions({ failedSession, futureSessions, goal, runs }) {
  return futureSessions.map((session, index) => {
    const reduction = failedSession.status === 'expired' ? 0.85 : 0.9;
    const targetDistance = clampDistance(
      Number(session.target_distance) * reduction + index * 0.1,
      goal,
    );

    return {
      ...session,
      target_distance: targetDistance,
      target_duration_minutes: estimateDurationMinutes(targetDistance, runs),
      status: 'locked',
      note: 'ปรับลดความหนักหลังเควสไม่สำเร็จ เพื่อให้กลับเข้าสู่แผนได้ต่อเนื่อง',
    };
  });
}

function summarizeAnalysis({ goal, runs, trigger }) {
  const latestRun = runs[runs.length - 1];
  const goalText = goal
    ? `${goal.goal_type || 'running goal'} ${goal.target_distance || ''} km`.trim()
    : 'running goal';

  return {
    summary: `AI placeholder วิเคราะห์จากเป้าหมาย ${goalText} และประวัติการวิ่ง ${runs.length} รายการ`,
    recommendation: trigger === 'initial_plan'
      ? 'สร้างตารางแบบค่อยเป็นค่อยไป โดยมีวันพักแทรกในแต่ละสัปดาห์'
      : 'ปรับเฉพาะเควสที่ยังไม่เกิด และลดความหนักลงชั่วคราว',
    latest_run: latestRun || null,
  };
}

module.exports = {
  adjustFutureSessions,
  createTrainingSessions,
  summarizeAnalysis,
};
