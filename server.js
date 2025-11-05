// server.js - Backend Node.js pour Carte Canadienne du Handicap
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Configuration de la base de données
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'franck911', // À adapter à ton environnement
  database: 'carte_handicap_canada'
});

db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err);
    return;
  }
  console.log('Connecté à la base de données MySQL');
});

// Configuration de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/documents';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Format de fichier non supporté'));
  }
});

// Génération numéro de compte
function generateAccountNumber() {
  return 'ACC' + Date.now().toString().slice(-9);
}

// ============ ROUTES API ============

// 1. INSCRIPTION
app.post('/api/inscription', upload.single('proofDocument'), async (req, res) => {
  try {
    const { prenom, nom, email, adresse, password, handicapTypes } = req.body;
    if (!prenom || !nom || !email || !password || !handicapTypes)
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    if (!req.file) return res.status(400).json({ message: 'Document médical requis' });

    const checkEmail = 'SELECT * FROM user_info WHERE email = ?';
    db.query(checkEmail, [email], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Erreur serveur' });
      if (results.length > 0) return res.status(400).json({ message: 'Cet email est déjà utilisé' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const numeroCompte = generateAccountNumber();

      const insertUser = `
        INSERT INTO user_info 
        (email, password, first_name, last_name, address, numero_de_compte, proof_document, statut_validation) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')
      `;
      db.query(insertUser, [email, hashedPassword, prenom, nom, adresse, numeroCompte, req.file.filename], (err, result) => {
        if (err) return res.status(500).json({ message: "Erreur lors de l'inscription" });
        const userId = result.insertId;

        let handicapArray = [];
        if (typeof handicapTypes === 'string') {
          try { handicapArray = JSON.parse(handicapTypes); } catch { handicapArray = [handicapTypes]; }
        } else {
          handicapArray = Array.isArray(handicapTypes) ? handicapTypes : [handicapTypes];
        }

        const insertHandicaps = 'INSERT INTO user_handicaps (user_id, handicap_type_id) VALUES ?';
        const handicapValues = handicapArray.map(typeId => [userId, parseInt(typeId)]);
        db.query(insertHandicaps, [handicapValues], (err) => {
          if (err) return res.status(500).json({ message: "Erreur lors de l'ajout des handicaps" });
          const insertValidation = 'INSERT INTO page_validation (user_id, statut_validation) VALUES (?, "en_attente")';
          db.query(insertValidation, [userId]);
          res.status(201).json({ message: 'Inscription réussie', numeroCompte, userId });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// 2. CONNEXION
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });
  const query = 'SELECT * FROM user_info WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    if (results.length === 0) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    if (user.statut_validation === 'en_attente')
      return res.status(403).json({ message: 'Compte en attente', statut: 'en_attente' });
    if (user.statut_validation === 'rejete')
      return res.status(403).json({ message: 'Demande rejetée', statut: 'rejete' });

    res.json({ message: 'Connexion réussie', userId: user.user_id, numeroCompte: user.numero_de_compte, statut: user.statut_validation });
  });
});

// 3. VALIDER UN UTILISATEUR + ASSIGNER UNE CARTE RFID
app.post('/api/validation/valider/:userId', (req, res) => {
  const userId = req.params.userId;
  const { approuve } = req.body;
  const statut = approuve ? 'valide' : 'rejete';

  const updateUser = 'UPDATE user_info SET statut_validation = ? WHERE user_id = ?';
  db.query(updateUser, [statut, userId], (err) => {
    if (err) return res.status(500).json({ message: 'Erreur lors de la validation' });

    const updateValidation = `
      UPDATE page_validation 
      SET statut_validation = ?, document_verifie = true, date_validation = NOW() 
      WHERE user_id = ?
    `;
    db.query(updateValidation, [approuve ? 'approuve' : 'rejete', userId]);

    if (approuve) {
      const findCard = 'SELECT uid FROM rfid_cards WHERE assigned = 0 LIMIT 1';
      db.query(findCard, (err, cardResults) => {
        if (err) return res.status(500).json({ message: 'Erreur recherche carte' });
        if (cardResults.length === 0) return res.json({ message: 'Utilisateur validé, mais aucune carte disponible' });

        const cardUID = cardResults[0].uid;
        const assignCard = `
          UPDATE rfid_cards 
          SET user_id = ?, active = 1, assigned = 1 
          WHERE uid = ?
        `;
        db.query(assignCard, [userId, cardUID], (err) => {
          if (err) return res.status(500).json({ message: 'Erreur assignation carte' });
          assignServicesToUser(userId);
          res.json({ message: `Utilisateur validé et carte ${cardUID} assignée.`, uid: cardUID });
        });
      });
    } else {
      res.json({ message: 'Utilisateur rejeté avec succès' });
    }
  });
});

// Fonction pour assigner les services
function assignServicesToUser(userId) {
  const getHandicaps = 'SELECT handicap_type_id FROM user_handicaps WHERE user_id = ?';
  db.query(getHandicaps, [userId], (err, handicaps) => {
    if (err) return;
    handicaps.forEach(h => {
      const getServices = 'SELECT accommodation_id FROM handicap_services WHERE handicap_type_id = ?';
      db.query(getServices, [h.handicap_type_id], (err, services) => {
        if (err) return;
        if (services.length > 0) {
          const insertLinks = 'INSERT INTO user_accommodation_link (user_id, accommodation_id) VALUES ?';
          const values = services.map(s => [userId, s.accommodation_id]);
          db.query(insertLinks, [values]);
        }
      });
    });
  });
}

// 4. OBTENIR INFOS UTILISATEUR
app.get('/api/user/:userId', (req, res) => {
  const userId = req.params.userId;
  const query = `
    SELECT user_id, email, first_name, last_name, address, numero_de_compte, statut_validation, date_creation
    FROM user_info 
    WHERE user_id = ?
  `;
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    if (results.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(results[0]);
  });
});

// 5. SERVICES D'UN UTILISATEUR
app.get('/api/user/:userId/services', (req, res) => {
  const userId = req.params.userId;
  const query = `
    SELECT DISTINCT a.service_name, a.service_description, a.province
    FROM user_accommodation_link ual
    JOIN accommodation_info a ON ual.accommodation_id = a.accommodation_id
    WHERE ual.user_id = ?
    ORDER BY a.service_name
  `;
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    res.json(results);
  });
});

// 6. VÉRIFICATION RFID (Arduino)
app.post('/check', (req, res) => {
  const uid = (req.body && req.body.uid) ? String(req.body.uid).trim().toUpperCase() : '';
  if (!uid) return res.status(400).json({ access: 'DENIED', reason: 'no_uid' });

  const sql = `
    SELECT 
      c.uid, c.active, c.expires_at,
      u.first_name, u.last_name, u.statut_validation
    FROM rfid_cards c
    LEFT JOIN user_info u ON u.user_id = c.user_id
    WHERE UPPER(c.uid) = ? 
    LIMIT 1
  `;

  db.query(sql, [uid], (err, rows) => {
    if (err) return res.status(500).json({ access: 'DENIED', reason: 'db_error' });
    if (!rows || rows.length === 0) return res.json({ access: 'DENIED', name: '', reason: 'unknown_uid' });

    const r = rows[0];
    const now = new Date();
    const notExpired = !r.expires_at || new Date(r.expires_at) > now;
    const granted = r.active && notExpired && r.statut_validation === 'valide';

    res.json({
      access: granted ? 'GRANTED' : 'DENIED',
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      reason: granted ? undefined : (!r.active ? 'inactive_card' : (!notExpired ? 'expired' : (!r.statut_validation ? 'not_validated' : 'denied')))
    });
  });
});

// 7. UTILISATEURS EN ATTENTE
app.get('/api/admin/pending-users', (req, res) => {
  const query = `
    SELECT u.user_id, u.first_name, u.last_name, u.email, u.date_creation, u.proof_document
    FROM user_info u
    WHERE u.statut_validation = 'en_attente'
    ORDER BY u.date_creation DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    res.json(results);
  });
});

// Start server
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));
