const API_BASE = 'http://localhost:4000/api';
const token = localStorage.getItem('runai_token');
const el = (id) => document.getElementById(id);
const message = el('pageMessage');
function logout() { localStorage.removeItem('runai_token'); localStorage.removeItem('runai_user'); window.location.href = 'index.html'; }
function show(messageText, type = 'success') { message.textContent = messageText; message.className = `message ${type}`; message.classList.toggle('hidden', !messageText); }
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { logout(); throw new Error('กรุณาเข้าสู่ระบบก่อนใช้งาน'); }
  if (!response.ok) throw new Error(data.error?.message || 'เชื่อมต่อ API ไม่สำเร็จ');
  return data;
}
function dateValue(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function formatDate(value) { return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function formatDistance(value) { return `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)} km`; }
function renderGoals(goals) {
  el('goalList').innerHTML = goals.length ? goals.map((goal) => `<div class="goal-item"><div><strong>${formatDistance(goal.target_distance)}</strong><small>${goal.goal_type || 'เป้าหมายการวิ่ง'} · ${formatDate(goal.target_date)}</small></div><span class="goal-status ${goal.status === 'active' ? 'active' : ''}">${goal.status === 'active' ? 'กำลังทำ' : 'สำเร็จแล้ว'}</span></div>`).join('') : '<p class="empty-state">ยังไม่มีเป้าหมาย ลองสร้างเป้าหมายแรกของคุณ</p>';
}
async function load() {
  try {
    const [me, goals] = await Promise.all([api('/me'), api('/goals')]);
    el('currentUserLabel').textContent = `${me.user.name || 'Runner'} · ${me.user.email || ''}`;
    renderGoals(goals.goals || []);
  } catch (error) { show(error.message, 'error'); }
}
el('logoutButton').addEventListener('click', logout);
el('goalForm').addEventListener('submit', async (event) => {
  event.preventDefault(); show('');
  const payload = { goal_type: el('goalTypeInput').value, target_distance: Number(el('goalDistanceInput').value), target_date: el('goalDateInput').value };
  if (el('goalDurationInput').value) payload.target_duration_minutes = Number(el('goalDurationInput').value);
  try { await api('/goals', { method: 'POST', body: JSON.stringify(payload) }); el('goalForm').reset(); el('goalDateInput').value = dateValue(new Date(Date.now() + 30 * 86400000)); show('บันทึกเป้าหมายแล้ว'); load(); }
  catch (error) { show(error.message, 'error'); }
});
if (!token) logout(); else { el('goalDateInput').min = dateValue(new Date()); el('goalDateInput').value = dateValue(new Date(Date.now() + 30 * 86400000)); load(); }
