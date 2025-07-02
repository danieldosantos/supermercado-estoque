const bcrypt = require('bcryptjs');
const db = require('./db');

const email = 'admin@admin.com';
const nome = 'Administrador';
const senha = 'admin12345';
const role = 'admin';
const senhaHash = bcrypt.hashSync(senha, 10);

db.run(
  `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)`,
  [nome, email, senhaHash, role],
  (err) => {
    if (err) {
      console.error('Erro ao inserir usuário admin:', err.message);
    } else {
      console.log('Usuário admin criado com sucesso.');
    }
  }
);
