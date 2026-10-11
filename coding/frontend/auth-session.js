(() => {
  const API_BASE = window.RUNAI_CONFIG?.apiBase || 'http://localhost:4000/api';
  let client = null;

  const clearRunAISession = () => {
    localStorage.removeItem('runai_token');
    localStorage.removeItem('runai_user');
  };

  const syncSession = (session) => {
    if (session?.access_token) localStorage.setItem('runai_token', session.access_token);
  };

  window.runaiSignOut = async () => {
    clearRunAISession();
    if (client) await client.auth.signOut();
  };

  window.runaiAuthReady = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/google/config`);
      if (!response.ok) return;
      const { supabaseUrl, publishableKey } = await response.json();
      client = window.supabase.createClient(supabaseUrl, publishableKey, {
        auth: { flowType: 'pkce', storageKey: 'runai-supabase-auth', autoRefreshToken: true },
      });
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') clearRunAISession();
        else syncSession(session);
      });
      const { data: { session } } = await client.auth.getSession();
      syncSession(session);
    } catch {
      // The protected page still reports its regular API error if Auth is unavailable.
    }
  })();
})();
