// server.js — Carte Handicap Canada (Modiva) — merged + Railway-ready
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------
// Middleware & static assets
// ------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
// ✅ Database Connection (Railway + Local Compatible)
let connectionUri =
  process.env.MYSQL_URL ||
  process.env.MYSQL_INTERNAL_URL ||
  process.env.DATABASE_URL ||
  process.env.MYSQL_PUBLIC_URL;

if (!connectionUri) {
  console.log('⚠️ No single URI found, falling back to manual connection settings');
  connectionUri = `mysql://${process.env.MYSQLUSER || 'root'}:${process.env.MYSQLPASSWORD || ''}@${process.env.MYSQLHOST || 'localhost'}:${process.env.MYSQLPORT || 3306}/${process.env.MYSQL_DATABASE || 'railway'}`;
}

// Log which environment we’re in
if (process.env.RAILWAY_ENVIRONMENT_NAME) {
  console.log('📦 Running on Railway → using internal DB connection');
} else {
  console.log('💻 Running locally → using public DB connection');
}

// Create connection
const db = mysql.createConnection(connectionUri);

db.connect((err) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données MySQL:');
    console.error(err.message || err);
  } else {
    console.log('✅ Connecté à la base de données MySQL');
  }
});


// ------------------------------
// Multer (file uploads)
// ------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/documents';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Format de fichier non supporté'));
  },
});

// ------------------------------
// Helpers
// ------------------------------
function generateAccountNumber() {
  return 'ACC' + Date.now().toString().slice(-9);
}

// ------------------------------
// Routes
// ------------------------------

// 1) INSCRIPTION
app.post('/api/inscription', upload.single('proofDocument'), async (req, res) => {
  try {
    const { prenom, nom, email, adresse, password, handicapTypes } = req.body;

    // Validation de base
    if (!prenom || !nom || !email || !password || !handicapTypes) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Document médical requis' });
    }

    // Email unique
    const checkEmail = 'SELECT * FROM user_info WHERE email = ?';
    db.query(checkEmail, [email], async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
      }
      if (results.length > 0) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const numeroCompte = generateAccountNumber();

      const insertUser = `
        INSERT INTO user_info 
        (email, password, first_name, last_name, address, numero_de_compte, proof_document, statut_validation) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')
      `;

      db.query(
        insertUser,
        [email, hashedPassword, prenom, nom, adresse, numeroCompte, req.file.filename],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: "Erreur lors de l'inscription" });
          }

          const userId = result.insertId;

          // Parser handicapTypes (string JSON, valeur simple, ou array)
          let handicapArray = [];
          if (typeof handicapTypes === 'string') {
            try {
              handicapArray = JSON.parse(handicapTypes);
            } catch {
              handicapArray = [handicapTypes];
            }
          } else {
            handicapArray = Array.isArray(handicapTypes) ? handicapTypes : [handicapTypes];
          }

          // Insérer les handicaps
          const insertHandicaps = 'INSERT INTO user_handicaps (user_id, handicap_type_id) VALUES ?';
          const handicapValues = handicapArray.map((typeId) => [userId, parseInt(typeId)]);

          db.query(insertHandicaps, [handicapValues], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ message: "Erreur lors de l'ajout des handicaps" });
            }

            // Enregistrer une entrée de validation
            const insertValidation =
              'INSERT INTO page_validation (user_id, statut_validation) VALUES (?, "en_attente")';
            db.query(insertValidation, [userId], (err) => {
              if (err) console.error(err);
            });

            res.status(201).json({
              message: 'Inscription réussie! Votre document sera vérifié.',
              numeroCompte: numeroCompte,
              userId: userId,
            });
          });
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// 2) LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email et mot de passe requis' });

  const query = 'SELECT * FROM user_info WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    if (results.length === 0)
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    if (user.statut_validation === 'en_attente') {
      return res.status(403).json({
        message: 'Votre compte est en attente de validation',
        statut: 'en_attente',
      });
    }
    if (user.statut_validation === 'rejete') {
      return res.status(403).json({
        message: 'Votre demande a été rejetée',
        statut: 'rejete',
      });
    }

    res.json({
      message: 'Connexion réussie',
      userId: user.user_id,
      numeroCompte: user.numero_de_compte,
      statut: user.statut_validation,
    });
  });
});

// ... (all your remaining routes remain unchanged)

// ------------------------------
// Start server
// ------------------------------
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
