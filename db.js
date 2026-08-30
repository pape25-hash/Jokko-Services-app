// db.js
// Ce fichier gère la connexion à la base SQLite et crée les tables si elles n'existent pas.

const Database = require('better-sqlite3');
const path = require('path');

// Le fichier "app.db" sera créé automatiquement dans le dossier du projet
// s'il n'existe pas déjà.
const db = new Database(path.join(__dirname, 'app.db'));

// On active le mode WAL pour de meilleures performances (optionnel mais recommandé)
db.pragma('journal_mode = WAL');

// Création de la table "users" si elle n'existe pas encore.
// C'est l'équivalent d'une "collection" en MongoDB, mais ici les colonnes
// sont fixes (id, name, email, created_at).
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

module.exports = db;
