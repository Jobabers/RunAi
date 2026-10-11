(() => {
  const element = (id) => document.getElementById(id);
  const message = (text) => { element('insightsMessage').textContent = text; };
  const number = (value) => Number(value || 0).toFixed(2);
  function showAnalysis(analysis) {
    const result = analysis?.result_json;
    element('insightsSource').textContent = analysis ? `Gemini · ${new Date(analysis.created_at).toLocaleString('th-TH')}` : '';
    element('insightsSummary').textContent = result?.summary || 'ยังไม่มีผลวิเคราะห์';
    element('insightsRecommendation').textContent = result?.recommendation || '';
  }
  window.loadRunInsights = async () => {
    const plan = dashboardState.activePlan;
    element('analyzeProgressButton').disabled = !plan;
    element('retryAnalysisButton').hidden = !plan || Boolean(plan.pending_adjustment)
      || !plan.sessions.some((session) => ['failed', 'expired'].includes(session.status));
    try {
      const data = await apiFetch('/insights');
      showAnalysis(data.analysis);
      const recent = data.metrics.recent;
      const previous = data.metrics.previous;
      element('insightsMetrics').textContent = `ล่าสุด ${recent.count} ครั้ง · ${number(recent.distance_km)} km · ${number(recent.duration_minutes)} นาที · Pace ${recent.pace_minutes_per_km == null ? '-' : number(recent.pace_minutes_per_km)} นาที/km`;
      if (previous.count) element('insightsMetrics').textContent += ` | ก่อนหน้า ${previous.count} ครั้ง · Pace ${number(previous.pace_minutes_per_km)} นาที/km`;
    } catch (error) { message(error.message); }
  };
  element('analyzeProgressButton').addEventListener('click', async () => {
    element('analyzeProgressButton').disabled = true; message('กำลังวิเคราะห์พัฒนาการ…');
    try { showAnalysis((await apiFetch('/insights', { method: 'POST' })).analysis); message('วิเคราะห์เรียบร้อยแล้ว'); }
    catch (error) { message(error.message); }
    finally { element('analyzeProgressButton').disabled = !dashboardState.activePlan; }
  });
  element('retryAnalysisButton').addEventListener('click', async () => {
    const plan = dashboardState.activePlan;
    if (!plan) return;
    element('retryAnalysisButton').disabled = true; message('กำลังเตรียมแผนปรับใหม่…');
    try {
      const result = await apiFetch(`/training-plans/${plan.training_plan_id}/retry-analysis`, { method: 'POST' });
      message(result.adjustment ? 'เตรียมแผนแล้ว กรุณาตรวจสอบก่อนยอมรับ' : 'ไม่มีเควสที่รอวิเคราะห์');
      await loadDashboard();
    } catch (error) { message(error.message); }
    finally { element('retryAnalysisButton').disabled = false; }
  });
})();
