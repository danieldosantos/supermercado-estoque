// Script global para gerenciar sessão e anexar token em requisições
(function() {
  const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));

  if (!usuario || !usuario.token) {
    if (window.location.pathname !== '/login') {
      alert('Sessão expirada. Faça login novamente.');
      window.location.href = '/login';
    }
    return;
  }

  const token = usuario.token;
  const originalFetch = window.fetch;
  window.fetch = function(input, init = {}) {
    init.headers = init.headers || {};
    init.headers['Authorization'] = 'Bearer ' + token;
    return originalFetch(input, init);
  };

  window.logout = async function() {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('usuarioLogado');
    window.location.href = '/login';
  };
})();
