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

// Formata datas no formato brasileiro (dd/mm/aaaa)
function formatarDataISO(iso) {
  if (!iso) return '';
  const opcoes = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Date(iso).toLocaleDateString('pt-BR', opcoes);
}

// Formata datas e horas no formato brasileiro (dd/mm/aaaa hh:mm:ss)
function formatarDataHoraISO(iso) {
  if (!iso) return '';
  const opcoes = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  return new Date(iso).toLocaleString('pt-BR', opcoes).replace(',', '');
}

// Mascara campos de preço permitindo apenas dígitos e
// exibindo o valor formatado em reais conforme a digitação
function mascararPrecoInput(event) {
  const input = event.target;
  const digits = input.value.replace(/\D/g, '');
  const valor = parseFloat(digits) / 100;
  const formatador = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  input.value = formatador.format(isNaN(valor) ? 0 : valor);
}
