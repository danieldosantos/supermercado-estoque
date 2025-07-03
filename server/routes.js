const express = require('express');
const router = express.Router();
const db = require('./db');
const path = require('path');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');

// Função simples para evitar XSS removendo < e > dos campos
const sanitize = (str) => String(str).replace(/[<>]/g, '');

function authMiddleware(req, res, next) {
  const user = req.session && req.session.user;
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
router.get('/fornecedores', (_, res) => res.sendFile(htmlPath('fornecedores.html')));
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
    bcrypt.compare(senha, user.senha_hash, (err, ok) => {
      if (err) return res.status(500).json({ erro: 'Erro ao verificar senha' });
      if (!ok) return res.status(401).json({ erro: 'Senha inválida' });
      req.session.user = { id: user.id, nome: user.nome, role: user.role };
      res.json({ id: user.id, nome: user.nome, role: user.role });
    });
  });
});

router.post('/api/logout', (req, res) => {
  if (req.sessionID) {
    req.sessionStore.destroy(req.sessionID, () => {
      res.setHeader('Set-Cookie', cookie.serialize('sid', '', { maxAge: 0, path: '/' }));
      res.json({ sucesso: true });
    });
  } else {
    res.json({ sucesso: true });
  }
});

// Criar novo usuário
router.post('/api/usuarios', authMiddleware, adminMiddleware, (req, res) => {
  const { nome, email, senha, role } = req.body;
  function inserir() {
    bcrypt.hash(senha, 10, (err, senhaHash) => {
      if (err) return res.status(500).json({ erro: 'Erro ao criptografar senha' });
      const sql = `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)`;
      db.run(sql, [nome, email, senhaHash, role], function (err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.status(201).json({ id: this.lastID });
      });
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
    bcrypt.compare(senha_atual, row?.senha_hash || '', (err, ok) => {
      if (err) return res.status(500).json({ erro: 'Erro ao verificar senha' });
      if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta' });
      bcrypt.hash(nova_senha, 10, (err, novaHash) => {
        if (err) return res.status(500).json({ erro: 'Erro ao criptografar senha' });
        db.run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [novaHash, id], (err) => {
          if (err) return res.status(500).json({ erro: 'Erro ao atualizar senha' });
          res.json({ sucesso: true });
        });
      });
    });
  });
});

// Produtos
router.post('/api/produtos', authMiddleware, adminMiddleware, (req, res) => {
  const {
    nome,
    codigo_barras,
    departamento,
    quantidade,
    validade,
    preco,
    fornecedor_id,
  } = req.body;

  if (!nome || !codigo_barras || !departamento || !preco) {
    return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos' });
  }

  const qtd = parseInt(quantidade, 10) || 0;
  const precoNum = parseFloat(String(preco).replace(/[R$\s\.]/g, '').replace(',', '.'));
  if (isNaN(precoNum)) {
    return res.status(400).json({ erro: 'Preço inválido' });
  }

  const sql = `INSERT INTO produtos (nome, codigo_barras, departamento, quantidade, validade, preco, fornecedor_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [nome, codigo_barras, departamento, qtd, validade, precoNum, fornecedor_id || null], function (err) {
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
  const { nome, departamento, quantidade, preco, validade, fornecedor_id } = req.body;
  const { id } = req.params;
  const qtd = parseInt(quantidade, 10) || 0;
  const precoNum = parseFloat(String(preco).replace(/[R$\s\.]/g, '').replace(',', '.'));
  if (isNaN(precoNum)) {
    return res.status(400).json({ erro: 'Preço inválido' });
  }

  const sql = `UPDATE produtos SET nome = ?, departamento = ?, quantidade = ?, preco = ?, validade = ?, fornecedor_id = ? WHERE id = ?`;
  db.run(sql, [nome, departamento, qtd, precoNum, validade, fornecedor_id || null, id], function (err) {
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
    let csv = 'id,nome,codigo_barras,departamento,quantidade,validade,preco,data_entrada,fornecedor_id\n';
    rows.forEach(r => {
      csv += `${r.id},${r.nome},${r.codigo_barras},${r.departamento},${r.quantidade},${r.validade || ''},${r.preco},${r.data_entrada},${r.fornecedor_id || ''}\n`;
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

router.get('/api/notificacoes/validade', authMiddleware, (_req, res) => {
  const sql = `SELECT nome, codigo_barras, validade, quantidade
               FROM produtos
               WHERE validade IS NOT NULL
                 AND date(validade) >= date('now')
                 AND date(validade) <= date('now', '+20 days')
               ORDER BY date(validade)`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

// Quebras
router.post('/api/quebras', authMiddleware, adminMiddleware, (req, res) => {
  const { produto_id, quantidade, valor_quebra } = req.body;
  const qtd = parseInt(quantidade, 10) || 0;
  const valorNum = parseFloat(String(valor_quebra).replace(/[R$\s\.]/g, '').replace(',', '.')) || 0;

  db.get('SELECT quantidade FROM produtos WHERE id = ?', [produto_id], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!row || row.quantidade < qtd) {
      return res.status(400).json({ erro: 'Quantidade insuficiente em estoque' });
    }

    const sql = `INSERT INTO quebras (produto_id, quantidade, valor_quebra) VALUES (?, ?, ?)`;
    db.run(sql, [produto_id, qtd, valorNum], function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      db.run(`UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?`, [qtd, produto_id]);
      db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
        ['Criação', 'Quebra', `Quebra ID ${this.lastID} criada`, 'Admin']);
      res.status(201).json({ id: this.lastID });
    });
  });
});

router.get('/api/quebras', authMiddleware, (req, res) => {
  const { departamento, ano, mes, dia } = req.query;
  let sql = `SELECT q.id, p.nome AS produto, p.departamento, q.quantidade, q.valor_quebra, q.data_quebra
             FROM quebras q JOIN produtos p ON q.produto_id = p.id WHERE 1=1`;
  const params = [];
  if (departamento) {
    sql += ' AND p.departamento = ?';
    params.push(departamento);
  }
  if (ano) {
    sql += " AND strftime('%Y', q.data_quebra) = ?";
    params.push(String(ano).padStart(4, '0'));
  }
  if (mes) {
    sql += " AND strftime('%m', q.data_quebra) = ?";
    params.push(String(mes).padStart(2, '0'));
  }
  if (dia) {
    sql += " AND strftime('%d', q.data_quebra) = ?";
    params.push(String(dia).padStart(2, '0'));
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

router.put('/api/quebras/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { produto_id, quantidade, valor_quebra, data_quebra } = req.body;
  const qtd = parseInt(quantidade, 10) || 0;
  const valorNum = parseFloat(String(valor_quebra).replace(/[R$\s\.]/g, '').replace(',', '.')) || 0;
  const sql = `UPDATE quebras SET produto_id = ?, quantidade = ?, valor_quebra = ?, data_quebra = ? WHERE id = ?`;
  db.run(sql, [produto_id, qtd, valorNum, data_quebra, id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Edição', 'Quebra', `Quebra ID ${id} editada`, 'Admin']);
    res.json({ atualizado: this.changes > 0 });
  });
});

router.delete('/api/quebras/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM quebras WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) return res.status(404).json({ erro: 'Registro não encontrado' });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Exclusão', 'Quebra', `Quebra ID ${id} excluída`, 'Admin']);
    res.json({ deletado: true });
  });
});

// Saídas
router.post('/api/saidas', authMiddleware, adminMiddleware, (req, res) => {
  const { produto_id, quantidade, valor_saida } = req.body;
  const qtd = parseInt(quantidade, 10) || 0;
  const valorNum = parseFloat(String(valor_saida).replace(/[R$\s\.]/g, '').replace(',', '.')) || 0;

  db.get('SELECT quantidade FROM produtos WHERE id = ?', [produto_id], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!row || row.quantidade < qtd) {
      return res.status(400).json({ erro: 'Quantidade insuficiente em estoque' });
    }

    const sql = `INSERT INTO saidas (produto_id, quantidade, valor_saida) VALUES (?, ?, ?)`;
    db.run(sql, [produto_id, qtd, valorNum], function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      db.run(`UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?`, [qtd, produto_id]);
      db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
        ['Criação', 'Saída', `Saída ID ${this.lastID} criada`, 'Admin']);
      res.status(201).json({ id: this.lastID });
    });
  });
});

router.get('/api/saidas', authMiddleware, (req, res) => {
  const { departamento, ano, mes, dia } = req.query;
  let sql = `SELECT s.id, p.nome AS produto, p.departamento, s.quantidade, s.valor_saida, s.data_saida
             FROM saidas s JOIN produtos p ON s.produto_id = p.id WHERE 1=1`;
  const params = [];
  if (departamento) {
    sql += ' AND p.departamento = ?';
    params.push(departamento);
  }
  if (ano) {
    sql += " AND strftime('%Y', s.data_saida) = ?";
    params.push(String(ano).padStart(4, '0'));
  }
  if (mes) {
    sql += " AND strftime('%m', s.data_saida) = ?";
    params.push(String(mes).padStart(2, '0'));
  }
  if (dia) {
    sql += " AND strftime('%d', s.data_saida) = ?";
    params.push(String(dia).padStart(2, '0'));
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

router.put('/api/saidas/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { produto_id, quantidade, valor_saida, data_saida } = req.body;
  const qtd = parseInt(quantidade, 10) || 0;
  const valorNum = parseFloat(String(valor_saida).replace(/[R$\s\.]/g, '').replace(',', '.')) || 0;
  const sql = `UPDATE saidas SET produto_id = ?, quantidade = ?, valor_saida = ?, data_saida = ? WHERE id = ?`;
  db.run(sql, [produto_id, qtd, valorNum, data_saida, id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Edição', 'Saída', `Saída ID ${id} editada`, 'Admin']);
    res.json({ atualizado: this.changes > 0 });
  });
});

router.delete('/api/saidas/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM saidas WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) return res.status(404).json({ erro: 'Registro não encontrado' });
    db.run(`INSERT INTO logs (acao, entidade, detalhes, usuario) VALUES (?, ?, ?, ?)`,
      ['Exclusão', 'Saída', `Saída ID ${id} excluída`, 'Admin']);
    res.json({ deletado: true });
  });
});

// Fornecedores
router.post('/api/fornecedores', authMiddleware, adminMiddleware, (req, res) => {
  const { nome, cnpj, telefone, email, endereco, data_inicio } = req.body;
  const sql = `INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco, data_inicio)
               VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [nome, cnpj, telefone, email, endereco, data_inicio], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

router.get('/api/fornecedores', authMiddleware, (req, res) => {
  const sql = `SELECT f.*, GROUP_CONCAT(p.nome) AS produtos
               FROM fornecedores f
               LEFT JOIN produtos p ON p.fornecedor_id = f.id
               GROUP BY f.id`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows.map(r => ({
      id: r.id,
      nome: r.nome,
      cnpj: r.cnpj,
      telefone: r.telefone,
      email: r.email,
      endereco: r.endereco,
      data_inicio: r.data_inicio,
      produtos: r.produtos ? r.produtos.split(',') : []
    })));
  });
});

router.put('/api/fornecedores/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { nome, cnpj, telefone, email, endereco, data_inicio } = req.body;
  const sql = `UPDATE fornecedores SET nome = ?, cnpj = ?, telefone = ?, email = ?, endereco = ?, data_inicio = ? WHERE id = ?`;
  db.run(sql, [nome, cnpj, telefone, email, endereco, data_inicio, id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ atualizado: this.changes > 0 });
  });
});

router.delete('/api/fornecedores/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM fornecedores WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) return res.status(404).json({ erro: 'Registro não encontrado' });
    res.json({ deletado: true });
  });
});

router.get('/api/fornecedores/:id/relatorio', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { format } = req.query;
  const sql = `SELECT
      IFNULL(SUM(p.quantidade),0) AS itens_fornecidos,
      IFNULL((SELECT SUM(q.quantidade) FROM quebras q JOIN produtos pr ON q.produto_id = pr.id WHERE pr.fornecedor_id = f.id),0) AS quebras,
      IFNULL((SELECT SUM(pr.quantidade) FROM produtos pr WHERE pr.fornecedor_id = f.id AND pr.validade < date('now')),0) AS vencidos,
      IFNULL(SUM(p.quantidade * p.preco),0) AS valor_total
    FROM fornecedores f
    LEFT JOIN produtos p ON p.fornecedor_id = f.id
    WHERE f.id = ?
    GROUP BY f.id`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!row) return res.status(404).json({ erro: 'Fornecedor não encontrado' });

    if (format === 'csv') {
      const csv = `itens_fornecidos,quebras,vencidos,valor_total\n${row.itens_fornecidos},${row.quebras},${row.vencidos},${row.valor_total}\n`;
      res.header('Content-Type', 'text/csv');
      res.attachment('relatorio.csv');
      return res.send(csv);
    }

    if (format === 'pdf') {
      let PDFDocument;
      try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }
      if (!PDFDocument) return res.status(500).json({ erro: 'PDF não suportado' });
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio.pdf');
      doc.pipe(res);
      doc.text(`Itens Fornecidos: ${row.itens_fornecidos}`);
      doc.text(`Quebras: ${row.quebras}`);
      doc.text(`Vencidos: ${row.vencidos}`);
      doc.text(`Valor Total: ${row.valor_total}`);
      return doc.end();
    }

    res.json(row);
  });
});

// Logs
router.get('/api/logs', authMiddleware, adminMiddleware, (_, res) => {
  db.all(`SELECT * FROM logs ORDER BY data_hora DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

// Resumo por departamento
router.get('/api/departamentos/resumo', authMiddleware, adminMiddleware, (_req, res) => {
  const sql = `
    SELECT
      p.departamento,
      SUM(p.quantidade * p.preco) AS valor_estoque,
      IFNULL((
        SELECT SUM(q.quantidade * p2.preco)
        FROM quebras q
        JOIN produtos p2 ON q.produto_id = p2.id
        WHERE p2.departamento = p.departamento
      ), 0) AS valor_quebras,
      IFNULL((
        SELECT SUM(s.quantidade * p3.preco)
        FROM saidas s
        JOIN produtos p3 ON s.produto_id = p3.id
        WHERE p3.departamento = p.departamento
      ), 0) AS valor_saidas
    FROM produtos p
    GROUP BY p.departamento
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

module.exports = router;
