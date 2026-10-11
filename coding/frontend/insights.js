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
  async function loadHistory() {
    const list = element('planHistoryList');
    list.textContent = 'กำลังโหลดประวัติ…';
    try {
      const data = await apiFetch('/plan-history');
      list.replaceChildren();
      if (!data.adjustments.length) list.textContent = 'ยังไม่มีประวัติการปรับแผน';
      for (const adjustment of data.adjustments) {
        const item = document.createElement('details');
        const title = document.createElement('summary');
        const statuses = { pending: 'รอยอมรับ', accepted: 'ยอมรับแล้ว', rejected: 'ปฏิเสธแล้ว' };
        title.textContent = `แผน #${adjustment.training_plan_id} · ${statuses[adjustment.status] || adjustment.status} · ${new Date(adjustment.created_at).toLocaleString('th-TH')}`;
        item.append(title);
        const explanation = document.createElement('p');
        const analysis = adjustment.analysis;
        explanation.textContent = `${analysis?.source === 'gemini' ? 'Gemini' : 'สูตรสำรอง'} · ${adjustment.reason || ''} ${analysis?.summary || ''} ${analysis?.recommendation || ''}`;
        item.append(explanation);
        const decision = document.createElement('p');
        decision.textContent = adjustment.status === 'pending' ? 'แผนเดิมยังใช้งานอยู่จนกว่าจะยอมรับ' : `ดำเนินการเมื่อ ${new Date(adjustment.accepted_at || adjustment.updated_at).toLocaleString('th-TH')}`;
        item.append(decision);
        const before = analysis?.previous_sessions;
        const dates = [...new Set([...(before || []).map((s) => s.session_date), ...adjustment.proposed_sessions.map((s) => s.session_date)])].sort();
        const wrapper = document.createElement('div');
        wrapper.className = 'insights-table-scroll';
        const table = document.createElement('table');
        const header = table.createTHead().insertRow();
        for (const label of ['วันที่', 'แผนเดิม', 'แผนที่เสนอ']) {
          const cell = document.createElement('th'); cell.textContent = label; header.append(cell);
        }
        const body = table.createTBody();
        const describe = (session) => session ? `${session.training_type} · ${session.target_distance} km · ${session.target_duration_minutes} นาที` : 'วันพัก';
        for (const date of dates) {
          const row = body.insertRow();
          const values = [date, before ? describe(before.find((s) => s.session_date === date)) : 'ไม่มีข้อมูลแผนเดิม', describe(adjustment.proposed_sessions.find((s) => s.session_date === date))];
          for (const value of values) row.insertCell().textContent = value;
        }
        wrapper.append(table); item.append(wrapper); list.append(item);
      }
    } catch (error) { list.textContent = error.message; }
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
      if (element('planHistoryDetails').open) await loadHistory();
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
  element('planHistoryDetails').addEventListener('toggle', () => { if (element('planHistoryDetails').open) loadHistory(); });
})();
