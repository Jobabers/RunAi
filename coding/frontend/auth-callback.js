const API_BASE = window.RUNAI_CONFIG?.apiBase || 'http://localhost:4000/api';
const callbackMessage = document.getElementById('callbackMessage');

function setMessage(text) {
  callbackMessage.textContent = text;
}

async function getBrowserAuthConfig() {
  const response = await fetch(`${API_BASE}/auth/google/config`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'ยังเชื่อมต่อ Google Sign-In ไม่ได้');
  return data;
}

async function completeGoogleSignIn() {
  try {
    const { supabaseUrl, publishableKey } = await getBrowserAuthConfig();
    const client = window.supabase.createClient(supabaseUrl, publishableKey, {
      auth: { flowType: 'pkce', storageKey: 'runai-supabase-auth', detectSessionInUrl: false },
    });
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error_description') || params.get('error');
    if (oauthError) throw new Error(oauthError);

    const code = params.get('code');
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }

    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (!session?.access_token) throw new Error('ไม่พบ session จาก Google กรุณาลองเข้าสู่ระบบอีกครั้ง');

    const response = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'ไม่สามารถเตรียม Profile ได้');

    localStorage.setItem('runai_token', session.access_token);
    localStorage.setItem('runai_user', JSON.stringify(data.user));
    setMessage('เข้าสู่ระบบสำเร็จ กำลังไปยัง Dashboard...');
    window.location.replace('dashboard.html');
  } catch (error) {
    setMessage(`${error.message} กลับไปลองใหม่อีกครั้ง`);
  }
}

completeGoogleSignIn();
