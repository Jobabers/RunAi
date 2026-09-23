const API_BASE = 'http://localhost:4000/api';
const token = localStorage.getItem('runai_token');

const elements = {
  message: document.getElementById('dashboardMessage'),
  userLabel: document.getElementById('currentUserLabel'),
  logoutButton: document.getElementById('logoutButton'),
  nextActionText: document.getElementById('nextActionText'),
  profileGate: document.getElementById('profileGate'),
  profileGateForm: document.getElementById('profileGateForm'),
  firstRunGate: document.getElementById('firstRunGate'),
  firstRunForm: document.getElementById('firstRunForm'),
  goalGate: document.getElementById('goalGate'),
  goalGateForm: document.getElementById('goalGateForm'),
  dashboardWorkspace: document.getElementById('dashboardWorkspace'),
  activeGoalStat: document.getElementById('activeGoalStat'),
  activeGoalMeta: document.getElementById('activeGoalMeta'),
  activeGoalBar: document.getElementById('activeGoalBar'),
  weeklyDistanceStat: document.getElementById('weeklyDistanceStat'),
  weeklyDistanceMeta: document.getElementById('weeklyDistanceMeta'),
  totalRunsStat: document.getElementById('totalRunsStat'),
  averagePaceStat: document.getElementById('averagePaceStat'),
  latestRunMeta: document.getElementById('latestRunMeta'),
  foundationActionStat: document.getElementById('foundationActionStat'),
  foundationActionMeta: document.getElementById('foundationActionMeta'),
  quickRecordButton: document.getElementById('quickRecordButton'),
  questPanel: document.getElementById('questPanel'),
  questPanelTitle: document.getElementById('questPanelTitle'),
  questPanelText: document.getElementById('questPanelText'),
  questStatusPill: document.getElementById('questStatusPill'),
  questMeta: document.getElementById('questMeta'),
  questMetrics: document.getElementById('questMetrics'),
  questAdjustment: document.getElementById('questAdjustment'),
  questAdjustmentTitle: document.getElementById('questAdjustmentTitle'),
  questAdjustmentText: document.getElementById('questAdjustmentText'),
  questSubmitForm: document.getElementById('questSubmitForm'),
  generatePlanButton: document.getElementById('generatePlanButton'),
  acceptAdjustmentButton: document.getElementById('acceptAdjustmentButton'),
  recentRunsList: document.getElementById('recentRunsList'),
  progressChartBars: document.getElementById('progressChartBars'),
  progressChartMeta: document.getElementById('progressChartMeta'),
  historyList: document.getElementById('historyList'),
  goalLockedNote: document.getElementById('goalLockedNote'),
  calendarTitle: document.getElementById('calendarTitle'),
  calendarSummary: document.getElementById('calendarSummary'),
  trainingCalendar: document.getElementById('trainingCalendar'),
  calendarPrevButton: document.getElementById('calendarPrevButton'),
  calendarTodayButton: document.getElementById('calendarTodayButton'),
  calendarNextButton: document.getElementById('calendarNextButton'),
  profileForm: document.getElementById('profileForm'),
  goalForm: document.getElementById('goalForm'),
  runForm: document.getElementById('runForm'),
};

const inputs = {
  profileName: document.getElementById('profileNameInput'),
  profileAge: document.getElementById('profileAgeInput'),
  profileWeight: document.getElementById('profileWeightInput'),
  profileHeight: document.getElementById('profileHeightInput'),
  profileExperience: document.getElementById('profileExperienceInput'),
  goalType: document.getElementById('goalTypeInput'),
  goalDistance: document.getElementById('goalDistanceInput'),
  goalDuration: document.getElementById('goalDurationInput'),
  goalDate: document.getElementById('goalDateInput'),
  firstRunDistance: document.getElementById('firstRunDistanceInput'),
  firstRunDuration: document.getElementById('firstRunDurationInput'),
  profileGateName: document.getElementById('profileGateNameInput'),
  profileGateAge: document.getElementById('profileGateAgeInput'),
  profileGateWeight: document.getElementById('profileGateWeightInput'),
  profileGateHeight: document.getElementById('profileGateHeightInput'),
  profileGateExperience: document.getElementById('profileGateExperienceInput'),
  goalGateType: document.getElementById('goalGateTypeInput'),
  goalGateDistance: document.getElementById('goalGateDistanceInput'),
  goalGateDuration: document.getElementById('goalGateDurationInput'),
  goalGateDate: document.getElementById('goalGateDateInput'),
  runDate: document.getElementById('runDateInput'),
  runDistance: document.getElementById('runDistanceInput'),
  runDuration: document.getElementById('runDurationInput'),
  runType: document.getElementById('runTypeInput'),
  questDistance: document.getElementById('questDistanceInput'),
  questDuration: document.getElementById('questDurationInput'),
};

let dashboardState = {
  user: null,
  goals: [],
  runs: [],
  activePlan: null,
};

let calendarCursor = new Date();

function redirectToLogin() {
  localStorage.removeItem('runai_token');
  localStorage.removeItem('runai_user');
  window.location.href = 'index.html';
}

function showDashboardMessage(message, type = 'success') {
  if (!elements.message) return;

  elements.message.textContent = message;
  elements.message.className = `message ${type}`;
  elements.message.classList.toggle('hidden', !message);
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    redirectToLogin();
    throw new Error('กรุณาเข้าสู่ระบบก่อนใช้งาน');
  }

  if (!response.ok) {
    throw new Error(data.error?.message || 'เชื่อมต่อ API ไม่สำเร็จ');
  }

  return data;
}

function getNumberValue(input) {
  if (!input || input.value === '') return undefined;
  return Number(input.value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDistance(value) {
  const number = Number(value || 0);
  return `${number.toFixed(number % 1 === 0 ? 0 : 1)} km`;
}

function formatPace(distance, duration) {
  const pace = Number(duration) / Number(distance);
  if (!Number.isFinite(pace) || pace <= 0) return '-';
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60).toString().padStart(2, '0');
  return `${minutes}:${seconds} /km`;
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateValue}T00:00:00`));
}

function toDateInputValue(date) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function getTodayKey() {
  return toDateInputValue(new Date());
}

function getDefaultGoalDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toDateInputValue(date);
}

function getActiveGoal(goals) {
  return goals.find((goal) => goal.status === 'active') || null;
}

function getTodayQuest() {
  const today = getTodayKey();
  return (dashboardState.activePlan?.sessions || [])
    .find((session) => session.session_date === today) || null;
}

function getUpcomingQuest(fromDate = getTodayKey()) {
  return (dashboardState.activePlan?.sessions || [])
    .find((session) => session.session_date > fromDate) || null;
}

function getQuestStatusText(status) {
  const labels = {
    available: 'Available',
    locked: 'Locked',
    completed: 'Completed',
    failed: 'Failed',
    expired: 'Expired',
    rest: 'Rest Day',
  };

  return labels[status] || 'No Plan';
}

function getQuestTypeLabel(session) {
  if (!session) return 'Rest Day';
  return session.training_type || 'Quest Run';
}

function getPlanProgress(plan) {
  const sessions = plan?.sessions || [];
  const total = sessions.length;
  const completed = sessions.filter((session) => session.status === 'completed').length;
  const closed = sessions.filter((session) => ['completed', 'failed', 'expired'].includes(session.status)).length;

  return {
    total,
    completed,
    closed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

function getGoalProgressPercent(goal, runs, plan = null) {
  const planProgress = getPlanProgress(plan);
  if (planProgress.total) {
    return planProgress.percent;
  }

  const totalDistance = runs.reduce((sum, run) => sum + Number(run.distance || 0), 0);
  const targetDistance = Number(goal?.target_distance || 0);

  if (!targetDistance) return 0;
  return Math.min(100, Math.round((totalDistance / targetDistance) * 100));
}

function getWeekRange() {
  const today = new Date();
  const dayIndex = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - dayIndex);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
}

function isProfileComplete(user) {
  return Boolean(user?.name && user?.age && user?.weight && user?.height);
}

function renderUser(user) {
  if (!user) return;

  elements.userLabel.textContent = `${user.name || 'Runner'} · ${user.email || ''}`;
  inputs.profileGateName.value = user.name || '';
  inputs.profileGateAge.value = user.age || '';
  inputs.profileGateWeight.value = user.weight || '';
  inputs.profileGateHeight.value = user.height || '';
  inputs.profileGateExperience.value = user.experience_level || 'beginner';
  inputs.profileName.value = user.name || '';
  inputs.profileAge.value = user.age || '';
  inputs.profileWeight.value = user.weight || '';
  inputs.profileHeight.value = user.height || '';
  inputs.profileExperience.value = user.experience_level || 'beginner';
  localStorage.setItem('runai_user', JSON.stringify(user));
}

function renderStats() {
  const { goals, runs, user } = dashboardState;
  const activeGoal = getActiveGoal(goals);
  const todayQuest = getTodayQuest();
  const planProgress = getPlanProgress(dashboardState.activePlan);
  const totalDistance = runs.reduce((sum, run) => sum + Number(run.distance || 0), 0);
  const totalDuration = runs.reduce((sum, run) => sum + Number(run.duration_minutes || 0), 0);
  const goalPercent = getGoalProgressPercent(activeGoal, runs, dashboardState.activePlan);
  const week = getWeekRange();
  const weeklyDistance = runs
    .filter((run) => run.run_date >= week.start && run.run_date <= week.end)
    .reduce((sum, run) => sum + Number(run.distance || 0), 0);

  elements.totalRunsStat.textContent = String(runs.length);
  elements.weeklyDistanceStat.textContent = formatDistance(weeklyDistance);
  elements.weeklyDistanceMeta.textContent = `${formatDate(week.start)} - ${formatDate(week.end)}`;

  if (activeGoal) {
    elements.activeGoalStat.textContent = formatDistance(activeGoal.target_distance);
    elements.activeGoalMeta.textContent = planProgress.total
      ? `${planProgress.completed}/${planProgress.total} quests · ภายใน ${formatDate(activeGoal.target_date)}`
      : `${goalPercent}% · ภายใน ${formatDate(activeGoal.target_date)}`;
  } else {
    elements.activeGoalStat.textContent = '-';
    elements.activeGoalMeta.textContent = 'ยังไม่มีเป้าหมาย';
  }
  elements.activeGoalBar.style.width = `${goalPercent}%`;

  elements.averagePaceStat.textContent = totalDistance ? formatPace(totalDistance, totalDuration).replace(' /km', '') : '-';
  elements.latestRunMeta.textContent = totalDistance ? 'นาทีต่อกิโลเมตร' : 'ยังไม่มีประวัติวิ่ง';
  elements.foundationActionStat.textContent = runs.length ? 'Add Record' : 'First Record';
  elements.foundationActionMeta.textContent = runs.length
    ? `มี Running Record ${runs.length} รายการสำหรับดูพัฒนาการ`
    : 'บันทึกการวิ่งครั้งแรกเพื่อเริ่มดูพัฒนาการ';

  if (!isProfileComplete(user)) {
    elements.nextActionText.textContent = 'เริ่มจากกรอกข้อมูลพื้นฐานให้ครบก่อน';
  } else if (!runs.length) {
    elements.nextActionText.textContent = 'กรอกระยะทางและเวลาการวิ่งครั้งแรกก่อนเริ่มใช้งาน';
  } else if (!activeGoal) {
    elements.nextActionText.textContent = 'ต่อไปสร้างเป้าหมายการวิ่งของคุณ';
  } else if (!dashboardState.activePlan) {
    elements.nextActionText.textContent = 'สร้าง Training Plan เพื่อเริ่มเควสรายวัน';
  } else if (todayQuest?.status === 'available') {
    elements.nextActionText.textContent = 'วันนี้มี Daily Quest ให้ส่งผลก่อนหมดวัน';
  } else if (todayQuest && ['completed', 'failed', 'expired'].includes(todayQuest.status)) {
    elements.nextActionText.textContent = 'เควสวันนี้ถูกปิดแล้ว รอดูเควสวันถัดไป';
  } else if (dashboardState.activePlan) {
    elements.nextActionText.textContent = 'วันนี้เป็น Rest Day ไม่มีเควสให้ส่งผล';
  } else {
    elements.nextActionText.textContent = 'RunAI พร้อมสร้างแผนฝึกของคุณ';
  }
}

function renderGoalFormState() {
  const activeGoal = getActiveGoal(dashboardState.goals);
  const isLocked = Boolean(activeGoal);

  elements.goalLockedNote.classList.toggle('hidden', !isLocked);
  elements.goalForm.querySelectorAll('input, select, button').forEach((control) => {
    control.disabled = isLocked;
  });
}

function setQuestPanelState({
  status,
  title,
  text,
  meta,
  metrics = [],
  adjustment = null,
  showForm = false,
  showGenerate = false,
}) {
  elements.questPanelTitle.textContent = title;
  elements.questPanelText.textContent = text;
  elements.questStatusPill.textContent = getQuestStatusText(status);
  elements.questStatusPill.className = `quest-status-pill ${status || 'empty'}`;
  elements.questMeta.textContent = meta;
  elements.questSubmitForm.classList.toggle('hidden', !showForm);
  elements.generatePlanButton.classList.toggle('hidden', !showGenerate);
  elements.questAdjustment.classList.toggle('hidden', !adjustment);

  if (adjustment) {
    const proposedCount = Array.isArray(adjustment.proposed_sessions)
      ? adjustment.proposed_sessions.length
      : 0;
    elements.questAdjustmentTitle.textContent = 'AI เตรียมแผนปรับใหม่ไว้แล้ว';
    elements.questAdjustmentText.textContent = proposedCount
      ? `${proposedCount} เควสถัดไปจะถูกปรับหลังจากกดยอมรับ`
      : 'ไม่มีเควสอนาคตให้ปรับ แต่ระบบบันทึกผลวิเคราะห์ไว้แล้ว';
    elements.acceptAdjustmentButton.disabled = false;
  }

  elements.questMetrics.innerHTML = metrics.map((item) => `
    <div class="quest-metric">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join('');
}

function renderQuestPanel() {
  const activeGoal = getActiveGoal(dashboardState.goals);
  const activePlan = dashboardState.activePlan;
  const todayQuest = getTodayQuest();
  const pendingAdjustment = activePlan?.pending_adjustment || null;

  if (!activeGoal) {
    setQuestPanelState({
      status: 'empty',
      title: 'ยังไม่มี Goal',
      text: 'สร้าง Active Goal ก่อน แล้ว RunAI จะสร้าง Training Plan ให้ใน Sprint 2',
      meta: 'รอข้อมูลเป้าหมาย',
    });
    return;
  }

  if (!activePlan) {
    setQuestPanelState({
      status: 'empty',
      title: 'ยังไม่มี Training Plan',
      text: 'สร้างแผนฝึกจาก Active Goal เพื่อเปิดระบบ Daily Quest รายวัน',
      meta: `${formatDistance(activeGoal.target_distance)} · เป้าหมาย ${formatDate(activeGoal.target_date)}`,
      metrics: [
        { label: 'Goal', value: formatDistance(activeGoal.target_distance) },
        { label: 'Target Date', value: formatDate(activeGoal.target_date) },
      ],
      showGenerate: true,
    });
    return;
  }

  if (!todayQuest) {
    const nextQuest = getUpcomingQuest();
    setQuestPanelState({
      status: 'rest',
      title: 'วันนี้ไม่มีเควส',
      text: 'วันนี้เป็น Rest Day ไม่ต้อง Submit และระบบจะไม่สร้าง Training Progress',
      meta: `Plan v${activePlan.version || 1} · ${formatDate(activePlan.start_date)} - ${formatDate(activePlan.end_date)}`,
      metrics: [
        { label: 'Quest', value: 'Rest Day' },
        { label: 'Next Quest', value: nextQuest ? formatDate(nextQuest.session_date) : 'ยังไม่มี' },
        { label: 'Action', value: 'ไม่ต้องส่งผล' },
      ],
      adjustment: pendingAdjustment,
    });
    return;
  }

  const targetDistance = Number(todayQuest.target_distance || 0);
  const targetDuration = todayQuest.target_duration_minutes
    ? `${todayQuest.target_duration_minutes} min`
    : '-';
  const baseMetrics = [
    { label: 'Type', value: getQuestTypeLabel(todayQuest) },
    { label: 'Distance', value: formatDistance(targetDistance) },
    { label: 'Target Time', value: targetDuration },
  ];

  if (todayQuest.status === 'available') {
    setQuestPanelState({
      status: 'available',
      title: `วันนี้: ${getQuestTypeLabel(todayQuest)}`,
      text: todayQuest.note || 'ทำเควสตามแผน แล้วส่งระยะทางจริงกับเวลาที่ใช้ก่อนหมดวัน',
      meta: `หมดเวลาเมื่อขึ้นวันใหม่ · ${formatDate(todayQuest.session_date)}`,
      metrics: baseMetrics,
      adjustment: pendingAdjustment,
      showForm: true,
    });
    return;
  }

  const closedText = todayQuest.status === 'completed'
    ? 'เควสนี้สำเร็จแล้ว ส่งซ้ำหรือแก้ไขไม่ได้'
    : todayQuest.status === 'failed'
      ? 'เควสนี้ถูกบันทึกว่าไม่สำเร็จแล้ว ส่งซ้ำหรือแก้ไขไม่ได้'
      : todayQuest.status === 'expired'
        ? 'เควสนี้หมดเวลาแล้ว ระบบจะเตรียมข้อมูลสำหรับปรับแผน'
        : 'เควสนี้ยังไม่เปิดให้ส่งผล';

  setQuestPanelState({
    status: todayQuest.status,
    title: `${getQuestTypeLabel(todayQuest)} · ${getQuestStatusText(todayQuest.status)}`,
    text: closedText,
    meta: `Quest date · ${formatDate(todayQuest.session_date)}`,
    metrics: baseMetrics,
    adjustment: pendingAdjustment,
  });
}

function renderHistory() {
  if (!dashboardState.runs.length) {
    elements.historyList.innerHTML = '<tr><td colspan="5" class="table-empty">ยังไม่มีประวัติการวิ่ง</td></tr>';
    return;
  }

  elements.historyList.innerHTML = dashboardState.runs.map((run) => `<tr><td>${formatDate(run.run_date)}</td><td>${run.run_type || 'Easy Run'}</td><td>${formatDistance(run.distance)}</td><td>${Number(run.duration_minutes)} min</td><td>${formatPace(run.distance, run.duration_minutes)}</td></tr>`).join('');
}

function renderRecentRuns() {
  if (!dashboardState.runs.length) {
    elements.recentRunsList.innerHTML = '<p class="empty-state compact-empty-state">ยังไม่มีประวัติการวิ่ง</p>';
    return;
  }

  elements.recentRunsList.innerHTML = dashboardState.runs.slice(0, 5).map((run) => `
    <div class="recent-run-item">
      <span class="run-dot"></span>
      <div>
        <strong>${formatDate(run.run_date)}</strong>
        <small>${escapeHtml(run.run_type || 'Easy Run')}</small>
      </div>
      <div class="recent-run-metrics">
        <strong>${formatDistance(run.distance)}</strong>
        <small>${formatPace(run.distance, run.duration_minutes).replace(' /km', '/km')}</small>
      </div>
    </div>
  `).join('');
}

function renderProgressChart() {
  if (!dashboardState.runs.length) {
    elements.progressChartBars.innerHTML = '<p class="empty-state compact-empty-state">ยังไม่มีข้อมูลสำหรับกราฟ</p>';
    elements.progressChartMeta.textContent = 'Distance';
    return;
  }

  const chartRuns = [...dashboardState.runs]
    .slice(0, 8)
    .reverse();
  const maxDistance = Math.max(...chartRuns.map((run) => Number(run.distance || 0)), 1);

  elements.progressChartMeta.textContent = `${chartRuns.length} runs`;
  elements.progressChartBars.innerHTML = chartRuns.map((run) => {
    const height = Math.max(8, Math.round((Number(run.distance || 0) / maxDistance) * 100));
    return `
      <div class="progress-bar-item" title="${escapeHtml(formatDate(run.run_date))} · ${formatDistance(run.distance)}">
        <span style="--bar-height: ${height}%"></span>
        <small>${escapeHtml(formatDistance(run.distance).replace(' km', ''))}</small>
      </div>
    `;
  }).join('');
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function groupRunsByDate(runs) {
  return runs.reduce((groups, run) => {
    const date = run.run_date;
    const current = groups.get(date) || {
      count: 0,
      distance: 0,
      duration: 0,
      types: new Set(),
    };

    current.count += 1;
    current.distance += Number(run.distance || 0);
    current.duration += Number(run.duration_minutes || 0);
    current.types.add(run.run_type || 'Easy Run');
    groups.set(date, current);
    return groups;
  }, new Map());
}

function getPlanSessionsByDate(plan) {
  const sessions = plan?.sessions || [];
  return sessions.reduce((groups, session) => {
    groups.set(session.session_date, session);
    return groups;
  }, new Map());
}

function getPlanCalendarByDate(plan) {
  const days = plan?.calendar || [];
  return days.reduce((groups, day) => {
    groups.set(day.date, day);
    return groups;
  }, new Map());
}

function getCalendarCell({ key, day, outsideMonth, run, session, planDay, today }) {
  const isToday = key === today;
  let state = '';
  let label = '';
  let detail = '';

  if (session) {
    const targetDistance = Number(session.target_distance || 0);
    label = targetDistance
      ? `${session.training_type || 'Run'} ${formatDistance(targetDistance)}`
      : session.training_type || 'Rest';
    state = session.status || 'planned';
    detail = getQuestStatusText(session.status);

    if (session.status === 'available' && isToday) {
      state = 'today available';
      detail = 'Today Quest';
    } else if (session.status === 'locked') {
      state = 'planned';
      detail = 'Plan Preview';
    }
  } else if (run) {
    state = isToday ? 'today completed' : 'completed';
    label = formatDistance(run.distance);
    detail = run.count > 1 ? `${run.count} runs` : 'Completed';
  } else if (planDay) {
    state = isToday ? 'today rest' : 'rest';
    label = 'Rest Day';
    detail = 'No Quest';
  } else if (!session && isToday) {
    state = 'today';
    label = 'Today';
    detail = dashboardState.activePlan ? 'Rest Day' : 'No plan';
  }

  return `
    <div class="calendar-day ${state} ${outsideMonth ? 'outside-month' : ''}">
      <strong>${day}</strong>
      <span>${escapeHtml(label)}</span>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const monthKey = getMonthKey(calendarCursor);
  const today = getTodayKey();
  const runsByDate = groupRunsByDate(dashboardState.runs);
  const sessionsByDate = getPlanSessionsByDate(dashboardState.activePlan);
  const planDaysByDate = getPlanCalendarByDate(dashboardState.activePlan);
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const monthFormatter = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' });
  const monthRuns = dashboardState.runs.filter((run) => String(run.run_date).startsWith(monthKey));
  const monthSessions = [...sessionsByDate.values()].filter((session) => String(session.session_date).startsWith(monthKey));
  const completedCount = monthRuns.length;
  const plannedCount = monthSessions.length;
  const questDoneCount = monthSessions.filter((session) => ['completed', 'failed', 'expired'].includes(session.status)).length;

  elements.calendarTitle.textContent = monthFormatter.format(calendarCursor);
  elements.calendarSummary.textContent = plannedCount
    ? `${questDoneCount}/${plannedCount} quests closed · ${completedCount} running records`
    : `${completedCount} running records · Sprint 1 foundation`;

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const key = toDateInputValue(date);
    cells.push(getCalendarCell({
      key,
      day: date.getDate(),
      outsideMonth: date.getMonth() !== month,
      run: runsByDate.get(key),
      session: sessionsByDate.get(key),
      planDay: planDaysByDate.get(key),
      today,
    }));
  }

  elements.trainingCalendar.innerHTML = cells.join('');
}

function renderGateFlow() {
  const hasProfile = isProfileComplete(dashboardState.user);
  const hasFirstRun = dashboardState.runs.length > 0;
  const hasGoal = Boolean(getActiveGoal(dashboardState.goals));

  const needsProfile = !hasProfile;
  const needsFirstRun = hasProfile && !hasFirstRun;
  const needsGoal = hasProfile && hasFirstRun && !hasGoal;
  const isDashboardReady = hasProfile && hasFirstRun && hasGoal;

  elements.profileGate.classList.toggle('hidden', !needsProfile);
  elements.firstRunGate.classList.toggle('hidden', !needsFirstRun);
  elements.goalGate.classList.toggle('hidden', !needsGoal);
  elements.dashboardWorkspace.classList.toggle('hidden', !isDashboardReady);
}

function renderDashboard() {
  renderUser(dashboardState.user);
  renderGateFlow();
  renderStats();
  renderGoalFormState();
  renderQuestPanel();
  renderHistory();
  renderRecentRuns();
  renderProgressChart();
  renderCalendar();
}

async function loadDashboard() {
  showDashboardMessage('');
  try {
    const [meData, goalsData, runsData, planData] = await Promise.all([
      apiFetch('/me'),
      apiFetch('/goals'),
      apiFetch('/runs'),
      apiFetch('/training-plans/active'),
    ]);

    dashboardState = {
      user: meData.user,
      goals: goalsData.goals || [],
      runs: runsData.runs || [],
      activePlan: planData.plan || null,
    };

    renderDashboard();
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  }
}

async function handleFirstRunSubmit(event) {
  event.preventDefault();
  showDashboardMessage('');

  const payload = {
    run_date: getTodayKey(),
    distance: Number(inputs.firstRunDistance.value),
    duration_minutes: Number(inputs.firstRunDuration.value),
    run_type: 'Easy Run',
  };

  try {
    await apiFetch('/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    elements.firstRunForm.reset();
    showDashboardMessage('บันทึกข้อมูลการวิ่งครั้งแรกแล้ว');
    await loadDashboard();
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  }
}

function buildProfilePayload(sourceInputs) {
  const payload = {
    name: sourceInputs.name.value.trim(),
    experience_level: sourceInputs.experience.value,
  };
  const age = getNumberValue(sourceInputs.age);
  const weight = getNumberValue(sourceInputs.weight);
  const height = getNumberValue(sourceInputs.height);

  if (age !== undefined) payload.age = age;
  if (weight !== undefined) payload.weight = weight;
  if (height !== undefined) payload.height = height;

  return payload;
}

async function saveProfile(payload, successMessage) {
  try {
    const data = await apiFetch('/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    dashboardState.user = data.user;
    renderDashboard();
    showDashboardMessage(successMessage);
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  }
}

async function handleProfileGateSubmit(event) {
  event.preventDefault();
  showDashboardMessage('');

  await saveProfile(buildProfilePayload({
    name: inputs.profileGateName,
    age: inputs.profileGateAge,
    weight: inputs.profileGateWeight,
    height: inputs.profileGateHeight,
    experience: inputs.profileGateExperience,
  }), 'บันทึก Profile แล้ว ต่อไปกรอกข้อมูล First Run');
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  showDashboardMessage('');

  await saveProfile(buildProfilePayload({
    name: inputs.profileName,
    age: inputs.profileAge,
    weight: inputs.profileWeight,
    height: inputs.profileHeight,
    experience: inputs.profileExperience,
  }), 'บันทึกข้อมูลพื้นฐานแล้ว');
}

function buildGoalPayload(sourceInputs) {
  const payload = {
    goal_type: sourceInputs.type.value,
    target_distance: Number(sourceInputs.distance.value),
    target_date: sourceInputs.date.value,
  };

  const targetDuration = getNumberValue(sourceInputs.duration);
  if (targetDuration !== undefined) payload.target_duration_minutes = targetDuration;

  return payload;
}

async function generateTrainingPlan(goalId = null) {
  const activeGoal = getActiveGoal(dashboardState.goals);
  const targetGoalId = goalId || activeGoal?.goal_id;

  if (!targetGoalId) {
    throw new Error('ต้องมี Active Goal ก่อนสร้าง Training Plan');
  }

  const data = await apiFetch('/training-plans/generate', {
    method: 'POST',
    body: JSON.stringify({ goal_id: targetGoalId }),
  });

  dashboardState.activePlan = data.plan;
  return data.plan;
}

async function saveGoal(payload, successMessage) {
  try {
    const goalData = await apiFetch('/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await generateTrainingPlan(goalData.goal.goal_id);
    elements.goalGateForm.reset();
    elements.goalForm.reset();
    inputs.goalGateDate.value = getDefaultGoalDate();
    inputs.goalDate.value = getDefaultGoalDate();
    await loadDashboard();
    showDashboardMessage(`${successMessage} และสร้าง Training Plan แล้ว`);
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  }
}

async function handleGoalGateSubmit(event) {
  event.preventDefault();
  showDashboardMessage('');

  await saveGoal(buildGoalPayload({
    type: inputs.goalGateType,
    distance: inputs.goalGateDistance,
    duration: inputs.goalGateDuration,
    date: inputs.goalGateDate,
  }), 'บันทึก Goal แล้ว Dashboard พร้อมใช้งาน');
}

async function handleGoalSubmit(event) {
  event.preventDefault();
  showDashboardMessage('');

  await saveGoal(buildGoalPayload({
    type: inputs.goalType,
    distance: inputs.goalDistance,
    duration: inputs.goalDuration,
    date: inputs.goalDate,
  }), 'บันทึก Goal แล้ว');
}

async function handleRunSubmit(event) {
  event.preventDefault();
  showDashboardMessage('');

  const payload = {
    run_date: inputs.runDate.value,
    distance: Number(inputs.runDistance.value),
    duration_minutes: Number(inputs.runDuration.value),
    run_type: inputs.runType.value,
  };

  try {
    await apiFetch('/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    elements.runForm.reset();
    inputs.runDate.value = getTodayKey();
    showDashboardMessage('บันทึก Running Record แล้ว');
    await loadDashboard();
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  }
}

async function handleGeneratePlanClick() {
  showDashboardMessage('');
  elements.generatePlanButton.disabled = true;
  try {
    await generateTrainingPlan();
    await loadDashboard();
    showDashboardMessage('สร้าง Training Plan และเปิด Daily Quest แล้ว');
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  } finally {
    elements.generatePlanButton.disabled = false;
  }
}

async function handleQuestSubmit(event) {
  event.preventDefault();
  showDashboardMessage('');

  const todayQuest = getTodayQuest();
  if (!todayQuest) {
    showDashboardMessage('วันนี้ไม่มีเควสให้ส่งผล', 'error');
    return;
  }

  const actualDistance = Number(inputs.questDistance.value);
  const actualDuration = Number(inputs.questDuration.value);
  const targetDistance = Number(todayQuest.target_distance || 0);
  const payload = {
    actual_distance: actualDistance,
    actual_duration_minutes: actualDuration,
  };

  const isCompleted = actualDistance >= targetDistance;
  const endpoint = isCompleted
    ? `/training-sessions/${todayQuest.training_session_id}/submit`
    : `/training-sessions/${todayQuest.training_session_id}/fail`;

  if (!isCompleted) {
    payload.failure_reason = `วิ่งได้ ${formatDistance(actualDistance)} จากเป้าหมาย ${formatDistance(targetDistance)}`;
  }

  elements.questSubmitForm.querySelector('button[type="submit"]').disabled = true;

  try {
    await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    elements.questSubmitForm.reset();
    await loadDashboard();
    showDashboardMessage(isCompleted ? 'ส่งเควสสำเร็จแล้ว' : 'บันทึกเควสไม่สำเร็จแล้ว', isCompleted ? 'success' : 'error');
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  } finally {
    elements.questSubmitForm.querySelector('button[type="submit"]').disabled = false;
  }
}

async function handleAcceptAdjustmentClick() {
  const adjustmentId = dashboardState.activePlan?.pending_adjustment?.plan_adjustment_id;
  if (!adjustmentId) {
    showDashboardMessage('ยังไม่มีแผนปรับใหม่ให้ยอมรับ', 'error');
    return;
  }

  showDashboardMessage('');
  elements.acceptAdjustmentButton.disabled = true;

  try {
    await apiFetch(`/training-plans/adjustments/${adjustmentId}/accept`, {
      method: 'POST',
    });
    await loadDashboard();
    showDashboardMessage('ยอมรับแผนที่ AI ปรับให้แล้ว');
  } catch (error) {
    showDashboardMessage(error.message, 'error');
  } finally {
    elements.acceptAdjustmentButton.disabled = false;
  }
}

function bindEvents() {
  elements.logoutButton.addEventListener('click', redirectToLogin);
  elements.profileGateForm.addEventListener('submit', handleProfileGateSubmit);
  elements.firstRunForm.addEventListener('submit', handleFirstRunSubmit);
  elements.goalGateForm.addEventListener('submit', handleGoalGateSubmit);
  elements.profileForm.addEventListener('submit', handleProfileSubmit);
  elements.goalForm.addEventListener('submit', handleGoalSubmit);
  elements.runForm.addEventListener('submit', handleRunSubmit);
  elements.generatePlanButton.addEventListener('click', handleGeneratePlanClick);
  elements.acceptAdjustmentButton.addEventListener('click', handleAcceptAdjustmentClick);
  elements.questSubmitForm.addEventListener('submit', handleQuestSubmit);
  elements.calendarPrevButton.addEventListener('click', () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    renderCalendar();
  });
  elements.calendarTodayButton.addEventListener('click', () => {
    calendarCursor = new Date();
    renderCalendar();
  });
  elements.calendarNextButton.addEventListener('click', () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    renderCalendar();
  });
  elements.quickRecordButton.addEventListener('click', () => {
    document.getElementById('runPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    inputs.runDistance.focus({ preventScroll: true });
  });
}

function bootDashboard() {
  if (!token) {
    redirectToLogin();
    return;
  }

  inputs.runDate.value = getTodayKey();
  inputs.runDate.max = getTodayKey();
  inputs.goalGateDate.value = getDefaultGoalDate();
  inputs.goalGateDate.min = getTodayKey();
  inputs.goalDate.value = getDefaultGoalDate();
  inputs.goalDate.min = getTodayKey();
  bindEvents();
  loadDashboard();
}

bootDashboard();
