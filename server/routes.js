const express = require('express');
const router = express.Router();
const db = require('./db');
const path = require('path');
const bcrypt = require('bcryptjs');

const htmlPath = (page) => path.join(__dirname, '..', 'views', page);
const publicPath = (page) => path.join(__dirname, '..', 'public', page);

// Rotas de páginas HTML
router.get('/cadastro', (_, res) => res.sendFile(htmlPath('cadastro.html')));
router.get('/quebras', (_, res) => res.sendFile(htmlPath('quebras.html')));
router.get('/saidas', (_, res) => res.sendFile(htmlPath('saidas.html')));
router.get('/conferencia-quebras', (_, res) => res.sendFile(htmlPath('conferencia_quebras.html')));
router.get('/conferencia-saidas', (_, res) => res.sendFile(htmlPath('conferencia_saidas.html')));
router.get('/conferencia-estoque', (_, res) => res.sendFile(htmlPath('conferencia_estoque.html')));
router.get('/alterar-senha', (_, res) => res.sendFile(htmlPath('alterar_senha.html')));
router.get('/admin-criar-usuario', (_, res) => res.sendFile(htmlPath('admin_criar_usuario.html')));
router.get('/login', (_, res) => res.sendFile(htmlPath('login.html')));
router.get('/logs', (_, res) => res.sendFile(htmlPath('painel_logs.html')));
router.get('/painel', (_, res) => res.redirect('/'));
router.get('/', (_, res) => res.sendFile(publicPath('index.html')));

// Login
router.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ erro: 'Erro no banco de dados' });
    if (!user) return res.status(401).json({ erro: 'Usuário não encontrado' });
    const senhaCorreta = bcrypt.compareSync(senha, user.senha_hash);
    if (!senhaCorreta) return res.status(401).json({ erro: 'Senha inválida' });
    res.json({ id: user.id, nome: user.nome, role: user.role });
  });
});

// Criar novo usuário
router.post('/api/usuarios', (req, res) => {
  const { nome, email, senha, role } = req.body;
  const senhaHash = bcrypt.hashSync(senha, 10);
  const sql = `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)`;
  db.run(sql, [nome, email, senhaHash, role], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

// Alterar senha
router.put('/api/usuarios/:id/senha', (req, res) => {
  const { id } = req.params;
  const { senha_atual, nova_senha } = req.body;
  db.get('SELECT senha_hash FROM usuarios WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar usuário' });
    if (!row || !bcrypt.compareSync(senha_atual, row.senha_hash)) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }
    const novaHash = bcrypt.hashSync(nova_senha, 10);
    db.run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [novaHash, id], (err) => {
      if (err) return res.status(500).json({ erro: 'Erro ao atualizar senha' });
      res.json({ sucesso: true });
    });
  });
});

// Produtos
router.post('/api/produtos', (req, res) => {
  const { nome, codigo_barras, departamento, quantidade, validade, preco } = req.body;
  const sql = `INSERT INTO produtos (nome, codigo_barras, departamento, quantidade, validade, preco) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [nome, codigo_barras, departamento, quantidade, validade, preco], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Criação', 'Produto', `Produto ${nome} criado`, 'Admin']);
    res.status(201).json({ id: this.lastID });
  });
});

router.get('/api/produtos', (req, res) => {
  const { departamento } = req.query;
  let sql = 'SELECT * FROM produtos WHERE 1=1';
  const params = [];
  if (departamento) {
    sql += ' AND departamento = ?';
    params.push(departamento);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

router.put('/api/produtos/:id', (req, res) => {
  const { nome, departamento, quantidade, preco, validade } = req.body;
  const { id } = req.params;
  const sql = `UPDATE produtos SET nome = ?, departamento = ?, quantidade = ?, preco = ?, validade = ? WHERE id = ?`;
  db.run(sql, [nome, departamento, quantidade, preco, validade, id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Edição', 'Produto', `Produto ID ${id} editado`, 'Admin']);
    res.status(200).json({ atualizado: true });
  });
});

router.delete('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM produtos WHERE id = ?';
  db.run(sql, [id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) return res.status(404).json({ erro: 'Produto não encontrado' });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Exclusão', 'Produto', `Produto ID ${id} excluído`, 'Admin']);
    res.json({ deletado: true });
  });
});

// Logs
router.get('/api/logs', (_, res) => {
  db.all(`SELECT * FROM logs ORDER BY data_hora DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

module.exports = router;
