const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const loadEnv = require('../loadEnv');
loadEnv();
const db = require('./db');
const session = require('./session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ cookie: { maxAge: 60 * 60 * 1000 } }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas
app.use('/', routes);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
