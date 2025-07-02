// Script global para gerenciar sessão, menu e token de requisições
(function() {
  // Função de logout disponível sempre
  window.logout = async function() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('usuarioLogado');
    window.location.href = '/login';
  };

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
    init.headers['X-Session-Token'] = token;
    return originalFetch(input, init);
  };

  // Insere links extras para administradores em todas as páginas
  window.addEventListener('DOMContentLoaded', () => {
    if (usuario.role === 'admin') {
      const span = document.getElementById('links-admin');
      if (span) {
        span.innerHTML = `
          <a href="/cadastro">Cadastro</a>
          <a href="/quebras">Quebras</a>
          <a href="/saidas">Saídas</a>
          <a href="/logs">Logs</a>
          <a href="/painel-admin">Painel</a>
          <a href="/admin-criar-usuario">Novo Usuário</a>
        `;
      }
    }
  });
})();
