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
function today() { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
async function load() {
  try { const me = await api('/me'); el('currentUserLabel').textContent = `${me.user.name || 'Runner'} · ${me.user.email || ''}`; }
  catch (error) { show(error.message, 'error'); }
}
el('logoutButton').addEventListener('click', logout);
el('runForm').addEventListener('submit', async (event) => {
  event.preventDefault(); show('');
  const payload = { run_date: el('runDateInput').value, distance: Number(el('runDistanceInput').value), duration_minutes: Number(el('runDurationInput').value), run_type: el('runTypeInput').value };
  try { await api('/runs', { method: 'POST', body: JSON.stringify(payload) }); el('runForm').reset(); el('runDateInput').value = today(); show('บันทึกการวิ่งแล้ว'); }
  catch (error) { show(error.message, 'error'); }
});
if (!token) logout(); else { el('runDateInput').value = today(); el('runDateInput').max = today(); load(); }
