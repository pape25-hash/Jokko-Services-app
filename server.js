// server.js
// Backend complet pour Jokko Services : authentification, profils,
// annonces, mise en relation, messagerie. Utilise SQLite (pas MongoDB).
// Les paiements PayTech sont simulés pour l'instant (voir /api/create-paytech-payment).

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // limit généreux pour les photos en base64
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------

function createSession(phone) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, phone) VALUES (?, ?)').run(token, phone);
  return token;
}

function getUserFromReq(req) {
  const token = req.cookies.sid;
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  const user = db.prepare('SELECT id, name, phone, role FROM users WHERE phone = ?').get(session.phone);
  return user || null;
}

function requireAuth(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ success: 0, message: 'Non connecté' });
  req.user = user;
  next();
}

function setSessionCookie(res, token) {
  res.cookie('sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 jours
  });
}

// ---------- Auth ----------

app.post('/api/auth/register', (req, res) => {
  const { name, phone, password, role } = req.body;
  if (!name || !phone || !password || !role) {
    return res.status(400).json({ success: 0, message: 'Tous les champs sont requis.' });
  }
  if (!['travailleur', 'employeur'].includes(role)) {
    return res.status(400).json({ success: 0, message: 'Rôle invalide.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(400).json({ success: 0, message: 'Ce numéro est déjà utilisé.' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, phone, password_hash, role);
  db.prepare('INSERT INTO subscriptions (phone, active) VALUES (?, 0)').run(phone);

  const token = createSession(phone);
  setSessionCookie(res, token);
  res.status(201).json({ success: 1, user: { name, phone, role } });
});

app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ success: 0, message: 'Numéro ou mot de passe incorrect.' });
  }
  const token = createSession(phone);
  setSessionCookie(res, token);
  res.json({ success: 1, user: { name: user.name, phone: user.phone, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.sid;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie('sid');
  res.json({ success: 1 });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ success: 0 });
  res.json({ success: 1, user });
});

// ---------- Profile (travailleur) ----------

app.get('/api/profile', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM profiles WHERE phone = ?').get(req.user.phone);
  if (!row) return res.status(404).json({ success: 0 });
  res.json({
    success: 1,
    profile: {
      name: req.user.name,
      phone: req.user.phone,
      city: row.city,
      services: JSON.parse(row.services || '[]'),
      traits: JSON.parse(row.traits || '[]'),
      skills: JSON.parse(row.skills || '[]'),
      experienceYears: row.experienceYears,
      availability: row.availability,
      salary: row.salary,
      bio: row.bio,
      photos: JSON.parse(row.photos || '[]')
    }
  });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const d = req.body;
  const existing = db.prepare('SELECT phone FROM profiles WHERE phone = ?').get(req.user.phone);
  const payload = [
    d.city || '',
    JSON.stringify(d.services || []),
    JSON.stringify(d.traits || []),
    JSON.stringify(d.skills || []),
    String(d.experienceYears || ''),
    d.availability || '',
    String(d.salary || ''),
    d.bio || '',
    JSON.stringify(d.photos || [])
  ];

  if (existing) {
    db.prepare(`
      UPDATE profiles SET city=?, services=?, traits=?, skills=?, experienceYears=?,
      availability=?, salary=?, bio=?, photos=?, updated_at=datetime('now') WHERE phone=?
    `).run(...payload, req.user.phone);
  } else {
    db.prepare(`
      INSERT INTO profiles (city, services, traits, skills, experienceYears, availability, salary, bio, photos, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...payload, req.user.phone);
  }
  res.json({ success: 1 });
});

// ---------- Jobpost (employeur) ----------

app.get('/api/jobpost', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM jobposts WHERE phone = ?').get(req.user.phone);
  if (!row) return res.status(404).json({ success: 0 });
  res.json({
    success: 1,
    jobpost: {
      name: req.user.name,
      phone: req.user.phone,
      city: row.city,
      service: row.service,
      availability: row.availability,
      budget: row.budget,
      description: row.description,
      photos: JSON.parse(row.photos || '[]')
    }
  });
});

app.put('/api/jobpost', requireAuth, (req, res) => {
  const d = req.body;
  const existing = db.prepare('SELECT phone FROM jobposts WHERE phone = ?').get(req.user.phone);
  const payload = [
    d.city || '',
    d.service || '',
    d.availability || '',
    String(d.budget || ''),
    d.description || '',
    JSON.stringify(d.photos || [])
  ];

  if (existing) {
    db.prepare(`
      UPDATE jobposts SET city=?, service=?, availability=?, budget=?, description=?, photos=?,
      updated_at=datetime('now') WHERE phone=?
    `).run(...payload, req.user.phone);
  } else {
    db.prepare(`
      INSERT INTO jobposts (city, service, availability, budget, description, photos, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(...payload, req.user.phone);
  }
  res.json({ success: 1 });
});

// ---------- Subscription (visibilité) ----------

app.get('/api/subscription', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM subscriptions WHERE phone = ?').get(req.user.phone);
  res.json({ success: 1, subscription: { active: !!(row && row.active) } });
});

app.post('/api/subscription/activate-test', requireAuth, (req, res) => {
  const { price } = req.body;
  const existing = db.prepare('SELECT phone FROM subscriptions WHERE phone = ?').get(req.user.phone);
  if (existing) {
    db.prepare(`UPDATE subscriptions SET active=1, price=?, updated_at=datetime('now') WHERE phone=?`)
      .run(price || null, req.user.phone);
  } else {
    db.prepare('INSERT INTO subscriptions (phone, active, price) VALUES (?, 1, ?)').run(req.user.phone, price || null);
  }
  res.json({ success: 1 });
});

app.post('/api/subscription/deactivate', requireAuth, (req, res) => {
  db.prepare(`UPDATE subscriptions SET active=0, updated_at=datetime('now') WHERE phone=?`).run(req.user.phone);
  res.json({ success: 1 });
});

// Paiement PayTech réel non configuré pour l'instant : on renvoie une erreur
// contrôlée que le frontend intercepte pour basculer en mode test (voir index.html).
app.post('/api/create-paytech-payment', requireAuth, (req, res) => {
  res.status(501).json({ success: 0, message: 'Paiement PayTech non configuré pour le moment.' });
});

// ---------- Browse (recherche) ----------

app.get('/api/browse', requireAuth, (req, res) => {
  const { city, service } = req.query;
  const me = req.user;

  const mySub = db.prepare('SELECT active FROM subscriptions WHERE phone = ?').get(me.phone);
  const iAmSubscribed = !!(mySub && mySub.active);

  let results = [];

  if (me.role === 'travailleur') {
    // Je cherche des annonces d'employeurs
    let rows = db.prepare(`
      SELECT j.*, u.name FROM jobposts j
      JOIN users u ON u.phone = j.phone
      JOIN subscriptions s ON s.phone = j.phone AND s.active = 1
      WHERE u.role = 'employeur'
    `).all();
    if (city) rows = rows.filter(r => r.city === city);
    if (service) rows = rows.filter(r => r.service === service);
    results = rows.map(r => ({
      name: r.name,
      phone: r.phone,
      city: r.city,
      service: r.service,
      availability: r.availability,
      budget: r.budget,
      description: r.description,
      photos: JSON.parse(r.photos || '[]')
    }));
  } else {
    // Je cherche des profils de travailleurs
    let rows = db.prepare(`
      SELECT p.*, u.name FROM profiles p
      JOIN users u ON u.phone = p.phone
      JOIN subscriptions s ON s.phone = p.phone AND s.active = 1
      WHERE u.role = 'travailleur'
    `).all();
    if (city) rows = rows.filter(r => r.city === city);
    if (service) rows = rows.filter(r => JSON.parse(r.services || '[]').includes(service));
    results = rows.map(r => ({
      name: r.name,
      phone: r.phone,
      city: r.city,
      services: JSON.parse(r.services || '[]'),
      traits: JSON.parse(r.traits || '[]'),
      skills: JSON.parse(r.skills || '[]'),
      experienceYears: r.experienceYears,
      availability: r.availability,
      salary: r.salary,
      bio: r.bio,
      photos: JSON.parse(r.photos || '[]')
    }));
  }

  res.json({ success: 1, results, iAmSubscribed });
});

// ---------- Contacts (mise en relation) ----------

app.get('/api/contacts', requireAuth, (req, res) => {
  const incoming = db.prepare('SELECT * FROM contacts WHERE to_phone = ? ORDER BY created_at DESC').all(req.user.phone)
    .map(c => ({ _id: c.id, fromName: c.from_name, fromPhone: c.from_phone, status: c.status }));
  const outgoing = db.prepare('SELECT * FROM contacts WHERE from_phone = ? ORDER BY created_at DESC').all(req.user.phone)
    .map(c => ({ _id: c.id, toName: c.to_name, toPhone: c.to_phone, status: c.status }));
  res.json({ success: 1, incoming, outgoing });
});

app.post('/api/contacts', requireAuth, (req, res) => {
  const { to, toName } = req.body;
  if (!to) return res.status(400).json({ success: 0, message: 'Destinataire requis.' });
  db.prepare(`
    INSERT INTO contacts (from_phone, from_name, to_phone, to_name, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(req.user.phone, req.user.name, to, toName || '');
  res.status(201).json({ success: 1 });
});

app.post('/api/contacts/:id/respond', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ success: 0, message: 'Statut invalide.' });
  }
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND to_phone = ?').get(req.params.id, req.user.phone);
  if (!contact) return res.status(404).json({ success: 0, message: 'Demande non trouvée.' });
  db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: 1 });
});

// ---------- Messages ----------

app.get('/api/conversations', requireAuth, (req, res) => {
  const accepted = db.prepare(`
    SELECT * FROM contacts WHERE status = 'accepted' AND (from_phone = ? OR to_phone = ?)
  `).all(req.user.phone, req.user.phone);

  const peers = new Map();
  accepted.forEach(c => {
    if (c.from_phone === req.user.phone) {
      peers.set(c.to_phone, c.to_name);
    } else {
      peers.set(c.from_phone, c.from_name);
    }
  });

  const conversations = Array.from(peers.entries()).map(([peerPhone, peerName]) => ({ peerPhone, peerName }));
  res.json({ success: 1, conversations });
});

app.get('/api/messages/:peer', requireAuth, (req, res) => {
  const peer = req.params.peer;
  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE (from_phone = ? AND to_phone = ?) OR (from_phone = ? AND to_phone = ?)
    ORDER BY created_at ASC
  `).all(req.user.phone, peer, peer, req.user.phone)
    .map(m => ({ from: m.from_phone, to: m.to_phone, text: m.text, created_at: m.created_at }));
  res.json({ success: 1, messages });
});

app.post('/api/messages/:peer', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ success: 0, message: 'Message vide.' });
  db.prepare('INSERT INTO messages (from_phone, to_phone, text) VALUES (?, ?, ?)')
    .run(req.user.phone, req.params.peer, text.trim());
  res.status(201).json({ success: 1 });
});

app.listen(PORT, () => {
  console.log(`Jokko Services démarré sur http://localhost:${PORT}`);
});
