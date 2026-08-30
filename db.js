// db.js
// Connexion SQLite + création de toutes les tables de Jokko Services.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('travailleur','employeur')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    phone TEXT PRIMARY KEY,
    city TEXT,
    services TEXT DEFAULT '[]',
    traits TEXT DEFAULT '[]',
    skills TEXT DEFAULT '[]',
    experienceYears TEXT,
    availability TEXT,
    salary TEXT,
    bio TEXT,
    photos TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobposts (
    phone TEXT PRIMARY KEY,
    city TEXT,
    service TEXT,
    availability TEXT,
    budget TEXT,
    description TEXT,
    photos TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    phone TEXT PRIMARY KEY,
    active INTEGER DEFAULT 0,
    price INTEGER,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_phone TEXT NOT NULL,
    from_name TEXT,
    to_phone TEXT NOT NULL,
    to_name TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
