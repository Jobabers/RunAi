const API_BASE = window.RUNAI_CONFIG?.apiBase || 'http://localhost:4000/api';

const messageBox = document.getElementById('messageBox');
const googleSignInButton = document.getElementById('googleSignInButton');

function showMessage(message, type = 'success') {
  if (!messageBox) return;
  messageBox.textContent = message;
  messageBox.className = `message ${type}`;
  messageBox.classList.toggle('hidden', !message);
}

async function getBrowserAuthConfig() {
  const response = await fetch(`${API_BASE}/auth/google/config`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'ยังเชื่อมต่อ Google Sign-In ไม่ได้');
  return data;
}

async function signInWithGoogle() {
  googleSignInButton.disabled = true;
  showMessage('กำลังพาไปเลือกบัญชี Google...');

  try {
    const { supabaseUrl, publishableKey } = await getBrowserAuthConfig();
    const client = window.supabase.createClient(supabaseUrl, publishableKey, {
      auth: { flowType: 'pkce', storageKey: 'runai-supabase-auth', detectSessionInUrl: false },
    });
    const redirectTo = new URL('auth-callback.html', window.location.href).toString();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  } catch (error) {
    showMessage(error.message, 'error');
    googleSignInButton.disabled = false;
  }
}

googleSignInButton.addEventListener('click', signInWithGoogle);
