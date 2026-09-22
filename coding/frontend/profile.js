const API_BASE = 'http://localhost:4000/api';
const token = localStorage.getItem('runai_token');
const elements = {
  form: document.getElementById('profileForm'), message: document.getElementById('profileMessage'),
  userLabel: document.getElementById('currentUserLabel'), logoutButton: document.getElementById('logoutButton'), saveButton: document.getElementById('saveButton'),
  name: document.getElementById('nameInput'), age: document.getElementById('ageInput'), weight: document.getElementById('weightInput'), height: document.getElementById('heightInput'), experience: document.getElementById('experienceInput'),
  initial: document.getElementById('profileInitial'), summaryName: document.getElementById('summaryName'), summaryEmail: document.getElementById('summaryEmail'), summaryExperience: document.getElementById('summaryExperience'), summaryAge: document.getElementById('summaryAge'), summaryWeight: document.getElementById('summaryWeight'), summaryHeight: document.getElementById('summaryHeight'),
};
function redirectToLogin() { localStorage.removeItem('runai_token'); localStorage.removeItem('runai_user'); window.location.href = 'index.html'; }
function showMessage(message, type = 'success') { elements.message.textContent = message; elements.message.className = `message ${type}`; elements.message.classList.toggle('hidden', !message); }
async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { redirectToLogin(); throw new Error('กรุณาเข้าสู่ระบบก่อนใช้งาน'); }
  if (!response.ok) throw new Error(data.error?.message || 'เชื่อมต่อ API ไม่สำเร็จ');
  return data;
}
function experienceLabel(value) { return { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }[value] || 'Beginner'; }
function displayValue(value, suffix = '') { return value ? `${value}${suffix}` : '-'; }
function renderUser(user) {
  const name = user.name || 'Runner';
  elements.userLabel.textContent = `${name} · ${user.email || ''}`; elements.initial.textContent = name.trim().charAt(0).toUpperCase() || 'R';
  elements.summaryName.textContent = name; elements.summaryEmail.textContent = user.email || '-'; elements.summaryExperience.textContent = experienceLabel(user.experience_level);
  elements.summaryAge.textContent = displayValue(user.age, ' ปี'); elements.summaryWeight.textContent = displayValue(user.weight, ' kg'); elements.summaryHeight.textContent = displayValue(user.height, ' cm');
  elements.name.value = user.name || ''; elements.age.value = user.age || ''; elements.weight.value = user.weight || ''; elements.height.value = user.height || ''; elements.experience.value = user.experience_level || 'beginner';
  localStorage.setItem('runai_user', JSON.stringify(user));
}
function setSaving(saving) { elements.saveButton.disabled = saving; elements.saveButton.textContent = saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'; }
async function loadProfile() { try { renderUser((await apiFetch('/me')).user); } catch (error) { showMessage(error.message, 'error'); } }
elements.form.addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage(''); setSaving(true);
  const optionalNumber = (input) => input.value === '' ? undefined : Number(input.value);
  const payload = { name: elements.name.value.trim(), experience_level: elements.experience.value, age: optionalNumber(elements.age), weight: optionalNumber(elements.weight), height: optionalNumber(elements.height) };
  try { renderUser((await apiFetch('/me', { method: 'PUT', body: JSON.stringify(payload) })).user); showMessage('บันทึกข้อมูลโปรไฟล์แล้ว'); }
  catch (error) { showMessage(error.message, 'error'); } finally { setSaving(false); }
});
elements.logoutButton.addEventListener('click', redirectToLogin);
if (!token) redirectToLogin(); else loadProfile();
