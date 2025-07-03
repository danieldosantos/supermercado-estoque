// Script global para gerenciar sessão e anexar token em requisições
(function() {
  const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));

  if (!usuario) {
    if (window.location.pathname !== '/login') {
      alert('Sessão expirada. Faça login novamente.');
      window.location.href = '/login';
    }
    return;
  }

  window.logout = async function() {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('usuarioLogado');
    window.location.href = '/login';
  };
})();

// Formata valores numéricos como preço em reais
function formatarPreco(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}
