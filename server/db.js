const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const loadEnv = require('../loadEnv');

// Carrega variáveis de ambiente do arquivo .env se existir
loadEnv();

// Caminho do arquivo do banco
// Se DB_PATH estiver definido, o valor é resolvido relativo à raiz do projeto
// para permitir definir caminhos fora da pasta `server`
const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.resolve(__dirname, 'estoque.sqlite');

// Conecta ao banco (cria se não existir)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
  }
});

// Criação das tabelas
db.serialize(() => {
  // Fornecedores
  db.run(`CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cnpj TEXT,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    data_inicio DATE
  )`);

  // Produtos
  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    codigo_barras TEXT UNIQUE NOT NULL,
    departamento TEXT,
    quantidade INTEGER DEFAULT 0,
    validade DATE,
    preco REAL,
    data_entrada DATE DEFAULT CURRENT_DATE,
    fornecedor_id INTEGER,
    estoque_minimo INTEGER DEFAULT 0,
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
  )`);

  // Atualiza tabela de produtos caso a coluna fornecedor_id esteja ausente
  db.all('PRAGMA table_info(produtos)', (err, rows) => {
    if (err) {
      console.error('Erro ao verificar colunas da tabela produtos:', err.message);
      return;
    }
    const hasForn = rows.some((r) => r.name === 'fornecedor_id');
    if (!hasForn) {
      db.run('ALTER TABLE produtos ADD COLUMN fornecedor_id INTEGER', (e) => {
        if (e) {
          console.error('Erro ao adicionar coluna fornecedor_id:', e.message);
        } else {
          console.log('Coluna fornecedor_id adicionada em produtos');
        }
      });
    }
  });

  // Quebras
  db.run(`CREATE TABLE IF NOT EXISTS quebras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER,
    data_quebra DATE DEFAULT CURRENT_DATE,
    quantidade INTEGER,
    valor_quebra REAL,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  )`);

  // Saídas
  db.run(`CREATE TABLE IF NOT EXISTS saidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER,
    data_saida DATE DEFAULT CURRENT_DATE,
    quantidade INTEGER,
    valor_saida REAL,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  )`);

  // Movimentações
  db.run(`CREATE TABLE IF NOT EXISTS movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER,
    acao TEXT,
    quantidade INTEGER,
    data DATE DEFAULT CURRENT_DATE,
    usuario TEXT,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS alertas_ruptura (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER UNIQUE,
    resolvido INTEGER DEFAULT 0,
    notificado INTEGER DEFAULT 0,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  )`);

  // Usuários
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'operador')) NOT NULL DEFAULT 'operador'
  )`);

  // Logs
  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    detalhes TEXT,
    usuario TEXT NOT NULL,
    data_hora TEXT DEFAULT (datetime('now', 'localtime'))
  )`);

  // Inserir usuário admin padrão se não existir
  db.get(`SELECT * FROM usuarios WHERE email = 'admin'`, (err, row) => {
    if (err) {
      console.error('Erro ao verificar usuário admin:', err.message);
    } else if (!row) {
      bcrypt.hash('admin12345', 10, (err, senhaHash) => {
        if (err) {
          console.error('Erro ao gerar hash da senha admin:', err.message);
          return;
        }
        db.run(
          `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)`,
          ['Administrador', 'admin', senhaHash, 'admin'],
          (err) => {
            if (err) {
              console.error('Erro ao inserir usuário admin:', err.message);
            } else {
              console.log('Usuário admin padrão criado (senha: admin12345)');
            }
          }
        );
      });
    }
  });
});

module.exports = db;
