const store = require('../storage');

function hasReachedGoalDistance(run, goal) {
  return Number(run?.distance || 0) >= Number(goal?.target_distance || 0);
}

async function completeActiveGoalIfReached(userId, run) {
  const activeGoal = await store.findActiveGoal(userId);
  if (!activeGoal || !hasReachedGoalDistance(run, activeGoal)) {
    return null;
  }

  const completedGoal = await store.updateRecord('goals', activeGoal.goal_id, {
    status: 'completed',
  });

  let completedPlan = null;
  const activePlan = await store.findActivePlan(userId);
  if (activePlan && Number(activePlan.goal_id) === Number(activeGoal.goal_id)) {
    completedPlan = await store.updateRecord('training_plans', activePlan.training_plan_id, {
      status: 'completed',
    });
  }

  return {
    goal: completedGoal,
    active_plan: completedPlan,
  };
}

module.exports = {
  completeActiveGoalIfReached,
  hasReachedGoalDistance,
};
