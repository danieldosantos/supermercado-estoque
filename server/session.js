const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const cookie = require('cookie');

class SQLiteStore {
  constructor(options = {}) {
    const dbPath = options.dbPath || path.join(__dirname, 'sessions.sqlite');
    this.db = new sqlite3.Database(dbPath);
    this.db.run(
      'CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT, expires INTEGER)'
    );
  }

  get(id, cb) {
    this.db.get(
      'SELECT data FROM sessions WHERE id = ? AND (expires IS NULL OR expires > ?)',
      [id, Date.now()],
      (err, row) => {
        if (err) return cb(err);
        cb(null, row ? JSON.parse(row.data) : null);
      }
    );
  }

  set(id, sess, cb) {
    const expires =
      (sess.cookie && sess.cookie.expires && new Date(sess.cookie.expires).getTime()) ||
      Date.now() + 60 * 60 * 1000;
    const data = JSON.stringify(sess);
    this.db.run(
      'INSERT OR REPLACE INTO sessions (id, data, expires) VALUES (?, ?, ?)',
      [id, data, expires],
      cb
    );
  }

  destroy(id, cb) {
    this.db.run('DELETE FROM sessions WHERE id = ?', [id], cb);
  }
}

function session(options = {}) {
  const store = options.store || new SQLiteStore(options);
  const name = options.name || 'sid';
  const maxAge = (options.cookie && options.cookie.maxAge) || 60 * 60 * 1000;

  return (req, res, next) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    let sid = cookies[name];

    const loadSession = (sess) => {
      req.sessionID = sid;
      req.sessionStore = store;
      req.session = sess || { cookie: { maxAge, expires: new Date(Date.now() + maxAge) } };
      res.setHeader(
        'Set-Cookie',
        cookie.serialize(name, sid, { httpOnly: true, path: '/', maxAge: Math.floor(maxAge / 1000) })
      );
      res.on('finish', () => store.set(sid, req.session, () => {}));
      next();
    };

    const createSession = () => {
      sid = crypto.randomBytes(16).toString('hex');
      loadSession();
    };

    if (!sid) {
      createSession();
    } else {
      store.get(sid, (err, sess) => {
        if (err) return next(err);
        if (!sess) return createSession();
        loadSession(sess);
      });
    }
  };
}

session.SQLiteStore = SQLiteStore;
module.exports = session;
