const API_BASE = 'http://localhost:4000/api';

const authForm = document.getElementById('authForm');
const messageBox = document.getElementById('messageBox');
const submitButton = document.getElementById('submitButton');
const apiStatus = document.getElementById('apiStatus');
const apiDot = document.getElementById('apiDot');
const REGISTER_SUCCESS_KEY = 'runai_registered_email';

function showMessage(message, type = 'success') {
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.className = `message ${type}`;
  messageBox.classList.toggle('hidden', !message);
}

function setLoading(isLoading) {
  if (!submitButton) return;

  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? 'กำลังดำเนินการ...' : submitButton.dataset.defaultText;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || 'เชื่อมต่อ API ไม่สำเร็จ');
  }

  return data;
}

async function checkApiHealth() {
  if (!apiStatus || !apiDot) return;

  try {
    const data = await apiFetch('/health');
    apiStatus.textContent = `API: ${data.status}`;
    apiDot.className = 'status-dot ok';
  } catch {
    apiStatus.textContent = 'API: ยังไม่พร้อม';
    apiDot.className = 'status-dot error';
  }
}

function getValue(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : '';
}

function buildLoginPayload() {
  return {
    email: getValue('emailInput'),
    password: getValue('passwordInput'),
  };
}

function buildRegisterPayload() {
  const password = getValue('passwordInput');
  const confirmPassword = getValue('confirmPasswordInput');

  if (password !== confirmPassword) {
    throw new Error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
  }

  return {
    email: getValue('emailInput'),
    password,
  };
}

function saveSession(data) {
  localStorage.setItem('runai_token', data.token);
  localStorage.setItem('runai_user', JSON.stringify(data.user));
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  showMessage('');
  setLoading(true);

  const mode = authForm.dataset.authForm;
  const isRegister = mode === 'register';

  try {
    const payload = isRegister ? buildRegisterPayload() : buildLoginPayload();
    const data = await apiFetch(isRegister ? '/auth/register' : '/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (isRegister) {
      sessionStorage.setItem(REGISTER_SUCCESS_KEY, payload.email);
      showMessage('สมัครสมาชิกสำเร็จ กำลังไปหน้าเข้าสู่ระบบ...');
      setTimeout(() => {
        window.location.href = 'index.html?registered=1';
      }, 700);
      return;
    }

    saveSession(data);
    showMessage('เข้าสู่ระบบสำเร็จ กำลังไปหน้า Dashboard...');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 500);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

function fillDemoData() {
  const registeredEmail = sessionStorage.getItem(REGISTER_SUCCESS_KEY);
  if (registeredEmail) {
    const emailInput = document.getElementById('emailInput');
    if (emailInput && !emailInput.value) {
      emailInput.value = registeredEmail;
    }
    sessionStorage.removeItem(REGISTER_SUCCESS_KEY);
    return;
  }

  const savedUser = localStorage.getItem('runai_user');
  if (!savedUser) return;

  try {
    const user = JSON.parse(savedUser);
    const emailInput = document.getElementById('emailInput');
    if (emailInput && !emailInput.value) {
      emailInput.value = user.email || '';
    }
  } catch {
    localStorage.removeItem('runai_user');
  }
}

function showRegisterSuccessMessage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('registered') === '1') {
    showMessage('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function boot() {
  if (!authForm || !submitButton) return;

  submitButton.dataset.defaultText = submitButton.textContent;
  authForm.addEventListener('submit', handleAuthSubmit);
  showRegisterSuccessMessage();
  fillDemoData();
  checkApiHealth();
}

boot();
