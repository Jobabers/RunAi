const API_BASE = 'http://localhost:4000/api';
const token = localStorage.getItem('runai_token');
const el = (id) => document.getElementById(id);
const message = el('pageMessage');
function logout() { localStorage.removeItem('runai_token'); localStorage.removeItem('runai_user'); window.location.href = 'index.html'; }
function show(messageText, type = 'success') { message.textContent = messageText; message.className = `message ${type}`; message.classList.toggle('hidden', !messageText); }
async function api(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { logout(); throw new Error('กรุณาเข้าสู่ระบบก่อนใช้งาน'); }
  if (!response.ok) throw new Error(data.error?.message || 'เชื่อมต่อ API ไม่สำเร็จ');
  return data;
}
function formatDistance(value) { return `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)} km`; }
function formatDate(value) { return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function render(runs) {
  const distance = runs.reduce((sum, run) => sum + Number(run.distance || 0), 0);
  const duration = runs.reduce((sum, run) => sum + Number(run.duration_minutes || 0), 0);
  el('totalRuns').textContent = runs.length; el('totalDistance').textContent = formatDistance(distance);
  el('averagePace').textContent = distance ? `${(duration / distance).toFixed(1)} min` : '-';
  el('historyList').innerHTML = runs.length ? runs.map((run) => `<div class="history-item history-row"><div><strong>${formatDistance(run.distance)}</strong><small>${run.run_type || 'Easy Run'} · ${formatDate(run.run_date)}</small></div><span>${Number(run.duration_minutes)} min</span></div>`).join('') : '<p class="empty-state">ยังไม่มีประวัติการวิ่ง เริ่มบันทึกการวิ่งครั้งแรกได้เลย</p>';
}
async function load() {
  try { const [me, runs] = await Promise.all([api('/me'), api('/runs')]); el('currentUserLabel').textContent = `${me.user.name || 'Runner'} · ${me.user.email || ''}`; render(runs.runs || []); }
  catch (error) { show(error.message, 'error'); }
}
el('logoutButton').addEventListener('click', logout);
if (!token) logout(); else load();
