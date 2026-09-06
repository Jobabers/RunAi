const crypto = require('crypto');
const config = require('../config');
const { HttpError } = require('../utils/httpError');

const devAuth = {
  usersByEmail: new Map(),
  sessions: new Map(),
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isSupabaseMode() {
  return config.storageDriver === 'supabase';
}

function getAuthApiKey() {
  return config.supabase.publishableKey || config.supabase.serviceRoleKey;
}

function requireSupabaseAuthConfig({ admin = false } = {}) {
  if (!config.supabase.authUrl) {
    throw new HttpError(500, 'ยังไม่ได้ตั้งค่า SUPABASE_URL สำหรับ Supabase Auth');
  }

  if (admin && !config.supabase.serviceRoleKey) {
    throw new HttpError(500, 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY สำหรับ Supabase Auth');
  }

  if (!admin && !getAuthApiKey()) {
    throw new HttpError(500, 'ยังไม่ได้ตั้งค่า SUPABASE_PUBLISHABLE_KEY หรือ SUPABASE_SERVICE_ROLE_KEY');
  }
}

async function readAuthResponse(response) {
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || 'เชื่อมต่อ Supabase Auth ไม่สำเร็จ';
    throw new HttpError(response.status, message, data);
  }

  return data;
}

async function supabaseAuthFetch(path, { method = 'GET', body = null, token = null, admin = false } = {}) {
  requireSupabaseAuthConfig({ admin });

  const apiKey = admin ? config.supabase.serviceRoleKey : getAuthApiKey();
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${token || apiKey}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${config.supabase.authUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return readAuthResponse(response);
}

async function registerWithSupabase({ email, password }) {
  try {
    const data = await supabaseAuthFetch('/admin/users', {
      method: 'POST',
      admin: true,
      body: {
        email: normalizeEmail(email),
        password,
        email_confirm: true,
        user_metadata: {
          app: 'RunAI',
        },
      },
    });

    return {
      id: data.user?.id || data.id,
      email: data.user?.email || data.email || normalizeEmail(email),
    };
  } catch (error) {
    if (error.status === 400 || error.status === 409 || error.status === 422) {
      throw new HttpError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    }
    throw error;
  }
}

async function loginWithSupabase({ email, password }) {
  const data = await supabaseAuthFetch('/token?grant_type=password', {
    method: 'POST',
    body: {
      email: normalizeEmail(email),
      password,
    },
  });

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    user: {
      id: data.user?.id,
      email: data.user?.email || normalizeEmail(email),
    },
  };
}

async function getSupabaseUserFromToken(token) {
  const data = await supabaseAuthFetch('/user', { token });
  return {
    id: data.id || data.user?.id,
    email: data.email || data.user?.email,
  };
}

function registerWithDevAuth({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const authUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
  };

  devAuth.usersByEmail.set(normalizedEmail, {
    ...authUser,
    password,
  });

  return authUser;
}

function loginWithDevAuth({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const authUser = devAuth.usersByEmail.get(normalizedEmail);

  if (!authUser || authUser.password !== password) {
    throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }

  const accessToken = `dev-${crypto.randomUUID()}`;
  devAuth.sessions.set(accessToken, {
    id: authUser.id,
    email: authUser.email,
  });

  return {
    accessToken,
    refreshToken: null,
    expiresIn: 60 * 60 * 24 * 7,
    tokenType: 'bearer',
    user: {
      id: authUser.id,
      email: authUser.email,
    },
  };
}

function getDevUserFromToken(token) {
  const user = devAuth.sessions.get(token);
  if (!user) {
    throw new HttpError(401, 'Token ไม่ถูกต้องหรือหมดอายุ');
  }

  return user;
}

async function registerUser(credentials) {
  return isSupabaseMode()
    ? registerWithSupabase(credentials)
    : registerWithDevAuth(credentials);
}

async function loginUser(credentials) {
  return isSupabaseMode()
    ? loginWithSupabase(credentials)
    : loginWithDevAuth(credentials);
}

async function getUserFromToken(token) {
  return isSupabaseMode()
    ? getSupabaseUserFromToken(token)
    : getDevUserFromToken(token);
}

function resetForTests() {
  devAuth.usersByEmail.clear();
  devAuth.sessions.clear();
}

module.exports = {
  getUserFromToken,
  loginUser,
  normalizeEmail,
  registerUser,
  resetForTests,
};
