(function configureRunAI() {
  const localHosts = new Set(['localhost', '127.0.0.1', '']);
  const isLocal = localHosts.has(window.location.hostname);

  window.RUNAI_CONFIG = {
    apiBase: isLocal
      ? 'http://localhost:4000/api'
      : 'https://runai-backend.onrender.com/api',
  };
}());
