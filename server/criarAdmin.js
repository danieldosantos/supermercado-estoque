const bcrypt = require('bcryptjs');
const db = require('./db');

const email = 'admin@admin.com';
const nome = 'Administrador';
const senha = 'admin12345';
const role = 'admin';
bcrypt.hash(senha, 10, (hashErr, senhaHash) => {
  if (hashErr) {
    console.error('Erro ao gerar hash da senha admin:', hashErr.message);
    return;
  }

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
});
