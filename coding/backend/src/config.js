require('dotenv').config();

function normalizeSupabaseProjectUrl(rawUrl = '') {
  return String(rawUrl)
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
    .replace(/\/auth\/v1$/i, '');
}

const supabaseProjectUrl = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL || '');

const config = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  storageDriver: process.env.STORAGE_DRIVER || 'memory',
  supabase: {
    url: supabaseProjectUrl,
    restUrl: supabaseProjectUrl ? `${supabaseProjectUrl}/rest/v1` : '',
    authUrl: supabaseProjectUrl ? `${supabaseProjectUrl}/auth/v1` : '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  ai: {
    provider: String(process.env.AI_PROVIDER || 'rule-based').trim(),
    geminiApiKey: String(process.env.GEMINI_API_KEY || '').trim(),
    model: String(process.env.AI_MODEL || 'gemini-3.8-flash').trim(),
  },
};

module.exports = config;
