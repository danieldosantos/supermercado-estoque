const express = require('express');
const router = express.Router();
const db = require('./db');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Chave secreta simples para assinar tokens JWT
const SECRET = process.env.JWT_SECRET || 'chave-secreta';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createSession(user) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ user, exp: Math.floor(Date.now() / 1000) + 60 * 60 }));
  const signature = base64url(crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64'));
  return `${header}.${payload}.${signature}`;
}

function getSession(token) {
  if (!token) return null;
  const [headerB64, payloadB64, signature] = token.split('.');
  if (!headerB64 || !payloadB64 || !signature) return null;
  const expected = base64url(crypto.createHmac('sha256', SECRET).update(`${headerB64}.${payloadB64}`).digest('base64'));
  if (expected !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.user;
  } catch (e) {
    return null;
  }
}

// Função simples para evitar XSS removendo < e > dos campos
const sanitize = (str) => String(str).replace(/[<>]/g, '');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = getSession(token);
  if (!user) return res.status(401).json({ erro: 'Sessão inválida' });
  req.user = user;
  next();
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// Remove tags HTML dos campos enviados nos formulários
function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const k of Object.keys(req.body)) {
      if (typeof req.body[k] === 'string') {
        req.body[k] = sanitize(req.body[k]);
      }
    }
  }
  next();
}

// Aplica sanitização a todas as rotas POST/PUT
router.use(express.json(), sanitizeBody);

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
router.get('/painel-admin', (_, res) => res.sendFile(htmlPath('painel_admin.html')));
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
    const token = createSession({ id: user.id, nome: user.nome, role: user.role });
    res.json({ id: user.id, nome: user.nome, role: user.role, token });
  });
});

router.post('/api/logout', (req, res) => {
  res.json({ sucesso: true });
});

// Criar novo usuário
router.post('/api/usuarios', authMiddleware, adminMiddleware, (req, res) => {
  const { nome, email, senha, role } = req.body;
  function inserir() {
    const senhaHash = bcrypt.hashSync(senha, 10);
    const sql = `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)`;
    db.run(sql, [nome, email, senhaHash, role], function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.status(201).json({ id: this.lastID });
    });
  }

  if (role === 'admin') {
    db.get('SELECT id FROM usuarios WHERE role = ? LIMIT 1', ['admin'], (err, row) => {
      if (err) return res.status(500).json({ erro: err.message });
      if (row) return res.status(400).json({ erro: 'Já existe um usuário admin' });
      inserir();
    });
  } else {
    inserir();
  }
});

// Alterar senha
router.put('/api/usuarios/:id/senha', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { senha_atual, nova_senha } = req.body;

  if (req.user.id !== Number(id) && req.user.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }

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
router.post('/api/produtos', authMiddleware, adminMiddleware, (req, res) => {
  const { nome, codigo_barras, departamento, quantidade, validade, preco } = req.body;

  if (!nome || !codigo_barras || !departamento || !preco) {
    return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos' });
  }

  const qtd = parseInt(quantidade, 10) || 0;
  const precoNum = parseFloat(String(preco).replace(/[R$\s\.]/g, '').replace(',', '.'));
  if (isNaN(precoNum)) {
    return res.status(400).json({ erro: 'Preço inválido' });
  }

  const sql = `INSERT INTO produtos (nome, codigo_barras, departamento, quantidade, validade, preco) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [nome, codigo_barras, departamento, qtd, validade, precoNum], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Criação', 'Produto', `Produto ${nome} criado`, 'Admin']);
    res.status(201).json({ id: this.lastID });
  });
});

router.get('/api/produtos', authMiddleware, (req, res) => {
  const { departamento, busca } = req.query;
  let sql = 'SELECT * FROM produtos WHERE 1=1';
  const params = [];
  if (departamento) {
    sql += ' AND departamento = ?';
    params.push(departamento);
  }
  if (busca) {
    sql += ' AND (nome LIKE ? OR codigo_barras LIKE ?)';
    params.push(`%${busca}%`, `%${busca}%`);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

router.put('/api/produtos/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { nome, departamento, quantidade, preco, validade } = req.body;
  const { id } = req.params;
  const qtd = parseInt(quantidade, 10) || 0;
  const precoNum = parseFloat(String(preco).replace(/[R$\s\.]/g, '').replace(',', '.'));
  if (isNaN(precoNum)) {
    return res.status(400).json({ erro: 'Preço inválido' });
  }

  const sql = `UPDATE produtos SET nome = ?, departamento = ?, quantidade = ?, preco = ?, validade = ? WHERE id = ?`;
  db.run(sql, [nome, departamento, qtd, precoNum, validade, id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Edição', 'Produto', `Produto ID ${id} editado`, 'Admin']);
    res.status(200).json({ atualizado: true });
  });
});

router.delete('/api/produtos/:id', authMiddleware, adminMiddleware, (req, res) => {
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

router.get('/api/produtos/export/csv', authMiddleware, adminMiddleware, (_, res) => {
  db.all('SELECT * FROM produtos', [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    let csv = 'id,nome,codigo_barras,departamento,quantidade,validade,preco,data_entrada\n';
    rows.forEach(r => {
      csv += `${r.id},${r.nome},${r.codigo_barras},${r.departamento},${r.quantidade},${r.validade || ''},${r.preco},${r.data_entrada}\n`;
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('produtos.csv');
    res.send(csv);
  });
});

router.get('/api/notificacoes/baixo-estoque', authMiddleware, (req, res) => {
  const limite = parseInt(req.query.limite) || 5;
  db.all('SELECT nome, quantidade FROM produtos WHERE quantidade < ?', [limite], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

// Logs
router.get('/api/logs', authMiddleware, adminMiddleware, (_, res) => {
  db.all(`SELECT * FROM logs ORDER BY data_hora DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

module.exports = router;
