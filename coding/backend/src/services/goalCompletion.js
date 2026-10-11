const store = require('../storage');

function hasReachedGoalDistance(run, goal) {
  const distance = Number(run?.distance);
  const duration = Number(run?.duration_minutes);
  const target = Number(goal?.target_distance);
  const targetTime = goal?.target_duration_minutes;
  return Number.isFinite(distance) && Number.isFinite(duration)
    && distance > 0 && duration > 0 && target > 0 && distance >= target
    && (targetTime == null || (Number(targetTime) > 0 && duration <= Number(targetTime)));
}

async function completeActiveGoalIfReached(userId, run) {
  const activeGoal = await store.findActiveGoal(userId);
  if (!activeGoal || activeGoal.achieved_at || !hasReachedGoalDistance(run, activeGoal)) {
    return null;
  }

  const completedGoal = await store.updateRecord('goals', activeGoal.goal_id, {
    achieved_at: new Date().toISOString(),
    achieved_run_id: run.run_id,
    achievement_choice: null,
  });


  return {
    goal: completedGoal,
    achieved: true,
  };
}

module.exports = {
  completeActiveGoalIfReached,
  hasReachedGoalDistance,
};
