function parsePrecoBR(valor) {
  if (valor === null || valor === undefined) return NaN;
  const str = String(valor).trim();
  if (!str) return NaN;

  const regexMilhar = /^\d{1,3}(\.\d{3})*(,\d+)?$/;
  const regexSimples = /^\d+(,\d+)?$/;
  if (!regexMilhar.test(str) && !regexSimples.test(str)) {
    return NaN;
  }

  const normalized = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? NaN : num;
}

module.exports = { parsePrecoBR };
