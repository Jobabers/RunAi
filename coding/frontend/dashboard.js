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
  totalRunsStat: document.getElementById('totalRunsStat'),
  totalDistanceStat: document.getElementById('totalDistanceStat'),
  latestRunStat: document.getElementById('latestRunStat'),
  averagePaceStat: document.getElementById('averagePaceStat'),
  latestRunMeta: document.getElementById('latestRunMeta'),
  stepList: document.getElementById('stepList'),
  historyList: document.getElementById('historyList'),
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
  const totalDistance = runs.reduce((sum, run) => sum + Number(run.distance || 0), 0);
  const latestRun = runs[0] || null;
  const totalDuration = runs.reduce((sum, run) => sum + Number(run.duration_minutes || 0), 0);

  elements.totalRunsStat.textContent = String(runs.length);
  elements.totalDistanceStat.textContent = formatDistance(totalDistance);

  if (activeGoal) {
    elements.activeGoalStat.textContent = formatDistance(activeGoal.target_distance);
    elements.activeGoalMeta.textContent = `ภายใน ${formatDate(activeGoal.target_date)}`;
  } else {
    elements.activeGoalStat.textContent = '-';
    elements.activeGoalMeta.textContent = 'ยังไม่มีเป้าหมาย';
  }

  elements.averagePaceStat.textContent = totalDistance ? formatPace(totalDistance, totalDuration).replace(' /km', '') : '-';
  elements.latestRunMeta.textContent = totalDistance ? 'นาทีต่อกิโลเมตร' : 'ยังไม่มีประวัติวิ่ง';

  if (!isProfileComplete(user)) {
    elements.nextActionText.textContent = 'เริ่มจากกรอกข้อมูลพื้นฐานให้ครบก่อน';
  } else if (!runs.length) {
    elements.nextActionText.textContent = 'กรอกระยะทางและเวลาการวิ่งครั้งแรกก่อนเริ่มใช้งาน';
  } else if (!activeGoal) {
    elements.nextActionText.textContent = 'ต่อไปสร้างเป้าหมายการวิ่งของคุณ';
  } else {
    elements.nextActionText.textContent = 'Sprint 1 flow พร้อมแล้ว ต่อไปค่อยต่อ AI plan';
  }
}

function renderSteps() {
  const { user, goals, runs } = dashboardState;
  const steps = [
    {
      done: true,
      label: 'US-01 บัญชีและ Profile',
      detail: isProfileComplete(user) ? 'เข้าสู่ระบบและ Profile ครบแล้ว' : 'กรอกข้อมูล Profile ให้ครบ',
    },
    {
      done: Boolean(getActiveGoal(goals)),
      label: 'US-02 เป้าหมายการวิ่ง',
      detail: getActiveGoal(goals) ? 'มี Goal active แล้ว' : 'สร้าง Goal หลังมี First Run',
    },
    {
      done: runs.length > 0,
      label: 'US-03 ประวัติการวิ่ง',
      detail: runs.length ? `บันทึกแล้ว ${runs.length} รายการ` : 'บันทึก First Run ก่อน',
    },
    {
      done: isProfileComplete(user) && runs.length > 0 && Boolean(getActiveGoal(goals)),
      label: 'US-04 ดูประวัติและพัฒนาการ',
      detail: 'สรุประยะทาง จำนวนครั้ง และ run ล่าสุด',
    },
  ];

  elements.stepList.innerHTML = steps.map((step) => `
    <li class="${step.done ? 'done' : ''}">
      <span class="step-marker">${step.done ? '✓' : ''}</span>
      <div>
        <strong>${step.label}</strong>
        <small>${step.detail}</small>
      </div>
    </li>
  `).join('');
}

function renderHistory() {
  if (!dashboardState.runs.length) {
    elements.historyList.innerHTML = '<tr><td colspan="5" class="table-empty">ยังไม่มีประวัติการวิ่ง</td></tr>';
    return;
  }

  elements.historyList.innerHTML = dashboardState.runs.map((run) => `<tr><td>${formatDate(run.run_date)}</td><td>${run.run_type || 'Easy Run'}</td><td>${formatDistance(run.distance)}</td><td>${Number(run.duration_minutes)} min</td><td>${formatPace(run.distance, run.duration_minutes)}</td></tr>`).join('');
}

function renderGoalProgress() {
  const goal = getActiveGoal(dashboardState.goals);
  const total = dashboardState.runs.reduce((sum, run) => sum + Number(run.distance || 0), 0);
  const percent = goal ? Math.min(100, Math.round(total / Number(goal.target_distance) * 100)) : 0;
  document.getElementById('goalProgressPercent').textContent = `${percent}%`;
  document.getElementById('goalProgressText').textContent = goal ? `${formatDistance(total)} จาก ${formatDistance(goal.target_distance)}` : 'ยังไม่มีเป้าหมาย';
  document.getElementById('goalProgressBar').style.width = `${percent}%`;
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

function getCalendarCell({ key, day, outsideMonth, run, session, today }) {
  const isToday = key === today;
  const isPast = key < today;
  let state = 'rest';
  let label = 'Rest';
  let detail = '';

  if (session) {
    const targetDistance = Number(session.target_distance || 0);
    label = `${session.training_type || 'Run'}${targetDistance ? ` ${formatDistance(targetDistance)}` : ''}`;
    detail = session.status || 'planned';

    if (session.status === 'expired' || session.status === 'failed' || (isPast && !run)) {
      state = 'missed';
      detail = 'Missed';
    } else if (session.status === 'locked') {
      state = 'upcoming';
      detail = 'Upcoming';
    } else {
      state = isToday ? 'today' : 'planned';
      detail = isToday ? 'Today' : 'Planned';
    }
  }

  if (run) {
    state = isToday ? 'today completed' : 'completed';
    label = formatDistance(run.distance);
    detail = run.count > 1 ? `${run.count} runs` : 'Completed';
  } else if (!session && isToday) {
    state = 'today';
    label = 'Today';
    detail = 'No run yet';
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
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const monthFormatter = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' });
  const monthRuns = dashboardState.runs.filter((run) => String(run.run_date).startsWith(monthKey));
  const monthSessions = [...sessionsByDate.values()].filter((session) => String(session.session_date).startsWith(monthKey));
  const completedCount = monthRuns.length;
  const plannedCount = monthSessions.length;
  const missedCount = monthSessions.filter((session) => (
    session.status === 'expired'
    || session.status === 'failed'
    || (session.session_date < today && !runsByDate.has(session.session_date))
  )).length;

  elements.calendarTitle.textContent = monthFormatter.format(calendarCursor);
  elements.calendarSummary.textContent = plannedCount
    ? `${completedCount} completed · ${plannedCount} planned · ${missedCount} missed`
    : `${completedCount} completed runs · no active training plan yet`;

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
  renderSteps();
  renderHistory();
  renderGoalProgress();
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

async function saveGoal(payload, successMessage) {
  try {
    await apiFetch('/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    elements.goalGateForm.reset();
    elements.goalForm.reset();
    inputs.goalGateDate.value = getDefaultGoalDate();
    inputs.goalDate.value = getDefaultGoalDate();
    showDashboardMessage(successMessage);
    await loadDashboard();
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
    showDashboardMessage('บันทึก Run แล้ว');
    await loadDashboard();
  } catch (error) {
    showDashboardMessage(error.message, 'error');
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
