// server.js
// Serveur Express avec des routes CRUD simples pour gérer des "users"
// en utilisant SQLite comme base de données.

const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Permet de lire du JSON dans le corps des requêtes (req.body)
app.use(express.json());

// --- Route de test ---
app.get('/', (req, res) => {
  res.json({ message: 'API en ligne. Base de données : SQLite.' });
});

// --- CREATE : ajouter un utilisateur ---
app.post('/users', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name et email sont requis' });
  }

  try {
    const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    const result = stmt.run(name, email);
    res.status(201).json({ id: result.lastInsertRowid, name, email });
  } catch (err) {
    // Erreur typique : email déjà utilisé (contrainte UNIQUE)
    res.status(400).json({ error: err.message });
  }
});

// --- READ : lister tous les utilisateurs ---
app.get('/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY id DESC').all();
  res.json(users);
});

// --- READ : récupérer un utilisateur par id ---
app.get('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.json(user);
});

// --- UPDATE : modifier un utilisateur ---
app.put('/users/:id', (req, res) => {
  const { name, email } = req.body;
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
    .run(name ?? existing.name, email ?? existing.email, id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(updated);
});

// --- DELETE : supprimer un utilisateur ---
app.delete('/users/:id', (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
