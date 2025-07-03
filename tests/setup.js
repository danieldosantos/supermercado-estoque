const path = require('path');
process.env.DB_PATH = 'tests/test.sqlite';
const fs = require('fs');
const dbFile = path.resolve(__dirname, process.env.DB_PATH);
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
const app = require('../server/server');
module.exports = app;
