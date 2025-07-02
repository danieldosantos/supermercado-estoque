// server/logger.js
const db = require('./db');

function registrarLog(acao, entidade, detalhes, usuario) {
  const sql = `INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`;
  db.run(sql, [acao, entidade, detalhes, usuario], (err) => {
    if (err) console.error('Erro ao registrar log:', err.message);
  });
}

module.exports = registrarLog;
