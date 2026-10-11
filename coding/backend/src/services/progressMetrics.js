function summarize(runs) {
  const distance = runs.reduce((sum, run) => sum + Number(run.distance), 0);
  const duration = runs.reduce((sum, run) => sum + Number(run.duration_minutes), 0);
  return { count: runs.length, distance_km: distance, duration_minutes: duration, pace_minutes_per_km: distance ? duration / distance : null };
}

function progressMetrics(runs) {
  const valid = runs.filter((run) => Number.isFinite(Number(run.distance)) && Number(run.distance) > 0
    && Number.isFinite(Number(run.duration_minutes)) && Number(run.duration_minutes) > 0)
    .sort((a, b) => String(b.run_date).localeCompare(String(a.run_date)) || Number(b.run_id) - Number(a.run_id));
  return { recent: summarize(valid.slice(0, 5)), previous: summarize(valid.slice(5, 10)), sample_run_ids: valid.slice(0, 10).map((run) => run.run_id) };
}

module.exports = { progressMetrics };
