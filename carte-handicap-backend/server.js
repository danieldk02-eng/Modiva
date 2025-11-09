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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// ------------------------------
// ✅ Database Configuration (Railway-compatible)
// ------------------------------
const isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
let connectionUri;

if (isRailway) {
  // Use Railway internal MySQL URL
  connectionUri = process.env.MYSQL_INTERNAL_URL;
  console.log('📦 Running on Railway → using INTERNAL DB');
} else {
  // Local fallback for development
  connectionUri = process.env.MYSQL_PUBLIC_URL || 'mysql://root:franck911@localhost:3306/carte_handicap_canada';
  console.log('💻 Running locally → using LOCAL DB');
}

if (!connectionUri) {
  console.error('❌ Missing MySQL connection URI');
  process.exit(1);
}

const db = mysql.createConnection(connectionUri);

db.connect((err) => {
  if (err) {
    console.error('❌ Erreur de connexion MySQL:', err.message || err);
    process.exit(1);
  }
  console.log('✅ Connecté à la base de données MySQL');
});

// ------------------------------
// Multer config (unchanged)
// ------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/documents';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté'));
    }
  }
});

// ------------------------------
// Helpers (unchanged)
// ------------------------------
function generateAccountNumber() {
  return 'ACC' + Date.now().toString().slice(-9);
}

// ------------------------------
// 🧠 Restore handicap → accommodations linking
// ------------------------------
function assignServicesToUser(userId) {
  const getHandicaps = 'SELECT handicap_type_id FROM user_handicaps WHERE user_id = ?';

  db.query(getHandicaps, [userId], (err, handicaps) => {
    if (err) {
      console.error('Erreur getHandicaps:', err);
      return;
    }

    handicaps.forEach((h) => {
      const getServices = 'SELECT accommodation_id FROM handicap_services WHERE handicap_type_id = ?';

      db.query(getServices, [h.handicap_type_id], (err, services) => {
        if (err) {
          console.error('Erreur getServices:', err);
          return;
        }

        if (services.length > 0) {
          const insertLinks = 'INSERT INTO user_accommodation_link (user_id, accommodation_id) VALUES ?';
          const values = services.map((s) => [userId, s.accommodation_id]);

          db.query(insertLinks, [values], (err) => {
            if (err) console.error('Erreur insertLinks:', err);
          });
        }
      });
    });
  });
}

// ✅ Get pending users
app.get('/api/admin/pending-users', (req, res) => {
  const query = `
  SELECT id, prenom, nom, email, proof_document, status, created_at
  FROM user_info
  WHERE status = 'pending'
  ORDER BY created_at DESC
`;
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json(results);
  });
});


// ✅ Approve or reject user (fixed)
app.post('/api/validation/valider/:userId', (req, res) => {
  const userId = req.params.userId;
  const { approuve } = req.body;
  const newStatus = approuve ? 'approved' : 'rejected';

  // Step 1: Update user status
  const updateUser = 'UPDATE user_info SET status = ? WHERE id = ?';
  db.query(updateUser, [newStatus, userId], (err, result) => {
    if (err) {
      console.error('Erreur update user:', err);
      return res.status(500).json({ message: 'Erreur lors de la validation' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // If rejected → stop here
    if (!approuve) {
      return res.json({ message: 'Utilisateur rejeté avec succès' });
    }
    assignServicesToUser(userId);

    // Step 2: Check if user already has an RFID
    const checkRFID = 'SELECT * FROM rfid WHERE user_id = ? LIMIT 1';
    db.query(checkRFID, [userId], (err, existing) => {
      if (err) {
        console.error('Erreur checkRFID:', err);
        return res.status(500).json({ message: 'Erreur vérification RFID' });
      }

      if (existing.length > 0) {
        return res.json({
          message: `Utilisateur déjà associé à un RFID (${existing[0].rfid_tag})`
        });
      }

      // Step 3: Find first available RFID
      const findRFID = 'SELECT id, rfid_tag FROM rfid WHERE user_id IS NULL LIMIT 1';
      db.query(findRFID, (err, rfidResults) => {
        if (err) {
          console.error('Erreur findRFID:', err);
          return res.status(500).json({ message: 'Erreur recherche RFID' });
        }

        if (rfidResults.length === 0) {
          return res.json({
            message: 'Utilisateur approuvé, mais aucun RFID disponible pour le moment.'
          });
        }

        const rfid = rfidResults[0];

        // Step 4: Assign RFID to user
        const assignRFID = 'UPDATE rfid SET user_id = ? WHERE id = ?';
        db.query(assignRFID, [userId, rfid.id], (err2) => {
          if (err2) {
            console.error('Erreur assignRFID:', err2);
            return res.status(500).json({ message: 'Erreur assignation RFID' });
          }
          assignServicesToUser(userId)

          res.json({
            message: `Utilisateur approuvé et RFID ${rfid.rfid_tag} assigné avec succès.`,
            assigned_rfid: rfid.rfid_tag
          });
        });
      });
    });
  });
});


// ------------------------------
// ✅ User registration route
// ------------------------------
app.post('/api/inscription', upload.single('proofDocument'), async (req, res) => {
  try {
    const { prenom, nom, email, adresse, password, handicapTypes } = req.body;

    if (!prenom || !nom || !email || !password || !handicapTypes) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Document médical requis' });
    }

    const checkEmail = 'SELECT id FROM user_info WHERE email = ?';
    db.query(checkEmail, [email], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Erreur serveur' });
      if (results.length > 0) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const numeroCompte = 'ACC' + Date.now().toString().slice(-9);

      const insertUser = `
        INSERT INTO user_info (email, password, prenom, nom, adresse, numero_de_compte, proof_document, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `;
      db.query(insertUser, [email, hashedPassword, prenom, nom, adresse, numeroCompte, req.file.filename], (err2, result) => {
        if (err2) return res.status(500).json({ message: 'Erreur lors de l\'inscription' });

        const userId = result.insertId;

        // 🧠 Parse handicapTypes robustly (array, JSON string, CSV, single value)
        let raw = handicapTypes;
        let ids = [];
        if (Array.isArray(raw)) {
          ids = raw;
        } else if (typeof raw === 'string') {
          try {
            const j = JSON.parse(raw);
            ids = Array.isArray(j) ? j : [j];
          } catch {
            ids = raw.includes(',') ? raw.split(',') : [raw];
          }
        } else if (raw != null) {
          ids = [raw];
        }
        ids = ids.map(v => parseInt(String(v).trim(), 10)).filter(Number.isFinite);

        if (ids.length > 0) {
          const insertHandicaps = 'INSERT INTO user_handicaps (user_id, handicap_type_id) VALUES ?';
          const values = ids.map(id => [userId, id]);
          db.query(insertHandicaps, [values], (err3) => {
            if (err3) console.error('❌ Erreur insertHandicaps:', err3);
            // even if this failed, we still created the user; continue response
            return res.status(201).json({
              message: 'Inscription réussie! Votre document sera vérifié.',
              numeroCompte,
              userId
            });
          });
        } else {
          console.warn('⚠️ No valid handicap IDs provided at signup');
          return res.status(201).json({
            message: 'Inscription réussie! Votre document sera vérifié.',
            numeroCompte,
            userId
          });
        }
      });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ------------------------------
// ✅ Login route (from old version)
// ------------------------------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  const query = 'SELECT * FROM user_info WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    if (results.length === 0) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Votre compte est en attente de validation', statut: 'pending' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Votre demande a été rejetée', statut: 'rejected' });
    }

    res.json({ message: 'Connexion réussie', userId: user.id, numeroCompte: user.numero_de_compte, statut: user.status });
  });
});

// ✅ Get user info
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT 
      prenom AS first_name,
      nom AS last_name,
      email,
      adresse AS address,
      numero_de_compte
    FROM user_info 
    WHERE id = ?
  `;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erreur MySQL:', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(results[0]);
  });
});

// ✅ Get user services (for now: example data)
  app.get('/api/user/:id/services', (req, res) => {
    const userId = req.params.id;

    const query = `
      SELECT DISTINCT a.service_name, a.service_description, a.province
      FROM user_accommodation_link ual
      JOIN accommodation_info a ON ual.accommodation_id = a.accommodation_id
      WHERE ual.user_id = ?
      ORDER BY a.service_name
    `;

    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Erreur services:', err);
        return res.status(500).json({ message: 'Erreur serveur' });
      }

      res.json(results);
    });
  });
  

// ✅ RFID scan endpoint for Arduino
app.post('/scan', express.json(), (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ access: "DENIED", reason: "No UID" });

  const query = `
    SELECT u.prenom, u.nom, u.status
    FROM rfid r
    JOIN user_info u ON u.id = r.user_id
    WHERE r.rfid_tag = ?
  `;

  db.query(query, [uid], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ access: "DENIED", reason: "DB error" });
    }

    if (results.length === 0) {
      return res.status(200).json({ access: "DENIED", reason: "Unknown card" });
    }

    const user = results[0];
    if (user.status !== 'approved') {
      return res.status(200).json({ access: "DENIED", name: `${user.prenom} ${user.nom}`, reason: "Not approved" });
    }

    // ✅ Mark scan time (optional)
    db.query("UPDATE rfid SET last_scan = NOW() WHERE rfid_tag = ?", [uid]);

    // ✅ Grant access
    res.status(200).json({
      access: "GRANTED",
      name: `${user.prenom} ${user.nom}`,
      disability_category: "N/A"
    });
  });
});


// ------------------------------
// ✅ All your existing routes below stay EXACTLY the same
// ------------------------------

// ... (keep your entire existing code exactly as-is here)

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`API disponible sur http://localhost:${PORT}`);
});







// // server.js — Carte Handicap Canada (Modiva) — merged + Railway-ready
// const express = require('express');
// const mysql = require('mysql2');
// const bcrypt = require('bcryptjs');
// const multer = require('multer');
// const path = require('path');
// const cors = require('cors');
// const fs = require('fs');
// const dotenv = require('dotenv');

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 3000;

// // ------------------------------
// // Middleware & static assets
// // ------------------------------
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', express.static('uploads'));

// // ------------------------------
// // ✅ Database Connection (Railway internal only)
// // ------------------------------
// const isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
// let connectionUri;

// if (isRailway) {
//   connectionUri = process.env.MYSQL_INTERNAL_URL; // internal DB for Railway
//   console.log('📦 Running on Railway → using INTERNAL DB');
// } else {
//   connectionUri = process.env.MYSQL_PUBLIC_URL || 'mysql://root@localhost:3306/railway';
//   console.log('💻 Running locally → using PUBLIC DB');
// }

// if (!connectionUri) {
//   console.error('❌ Missing MySQL connection URI');
//   process.exit(1);
// }

// const db = mysql.createConnection(connectionUri);

// db.connect((err) => {
//   if (err) {
//     console.error('❌ MySQL connect error:', err.message || err);
//     process.exit(1);
//   }
//   console.log('✅ Connected to MySQL');
// });


// // ------------------------------
// // Multer (file uploads)
// // ------------------------------
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const dir = './uploads/documents';
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//     cb(null, dir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
//     cb(null, uniqueName);
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowed = /pdf|jpg|jpeg|png/;
//     const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
//     const mimeOk = allowed.test(file.mimetype);
//     if (extOk && mimeOk) return cb(null, true);
//     cb(new Error('Format de fichier non supporté'));
//   },
// });

// // ------------------------------
// // Helpers
// // ------------------------------
// function generateAccountNumber() {
//   return 'ACC' + Date.now().toString().slice(-9);
// }

// // ------------------------------
// // Routes
// // ------------------------------

// // 1) INSCRIPTION
// app.post('/api/inscription', upload.single('proofDocument'), async (req, res) => {
//   try {
//     const { prenom, nom, email, adresse, password, handicapTypes } = req.body;

//     // Validation de base
//     if (!prenom || !nom || !email || !password || !handicapTypes) {
//       return res.status(400).json({ message: 'Tous les champs sont requis' });
//     }
//     if (!req.file) {
//       return res.status(400).json({ message: 'Document médical requis' });
//     }

//     // Email unique
//     const checkEmail = 'SELECT * FROM user_info WHERE email = ?';
//     db.query(checkEmail, [email], async (err, results) => {
//       if (err) {
//         console.error(err);
//         return res.status(500).json({ message: 'Erreur serveur' });
//       }
//       if (results.length > 0) {
//         return res.status(400).json({ message: 'Cet email est déjà utilisé' });
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);
//       const numeroCompte = generateAccountNumber();

//             const insertUser = `
//         INSERT INTO user_info 
//         (email, password, prenom, nom, adresse, status) 
//         VALUES (?, ?, ?, ?, ?, 'pending')
//       `;
//       db.query(
//         insertUser,
//         [email, hashedPassword, prenom, nom, adresse],
//         (err, result) => {
//           if (err) {
//             console.error(err);
//             return res.status(500).json({ message: "Erreur lors de l'inscription" });
//           }

//           const userId = result.insertId;
//           // 🪪 Assign first available RFID tag to this user
//             const assignRFID = `
//             UPDATE rfid 
//             SET user_id = ? 
//             WHERE user_id IS NULL 
//             ORDER BY id ASC 
//             LIMIT 1
//             `;

//             db.query(assignRFID, [userId], (err, rfidResult) => {
//             if (err) {
//               console.error('❌ RFID assign error:', err);
//             } else if (rfidResult.affectedRows === 0) {
//               console.log('⚠️ No available RFID tags left!');
//             } else {
//               console.log(`✅ RFID tag assigned automatically to user ${userId}`);
//             }
//             });


//           // Parser handicapTypes (string JSON, valeur simple, ou array)
//           let handicapArray = [];
//           if (typeof handicapTypes === 'string') {
//             try {
//               handicapArray = JSON.parse(handicapTypes);
//             } catch {
//               handicapArray = [handicapTypes];
//             }
//           } else {
//             handicapArray = Array.isArray(handicapTypes) ? handicapTypes : [handicapTypes];
//           }

//           // Insérer les handicaps
//           const insertHandicaps = 'INSERT INTO user_handicaps (user_id, handicap_type_id) VALUES ?';
//           const handicapValues = handicapArray.map((typeId) => [userId, parseInt(typeId)]);

//           db.query(insertHandicaps, [handicapValues], (err) => {
//             if (err) {
//               console.error(err);
//               return res.status(500).json({ message: "Erreur lors de l'ajout des handicaps" });
//             }

//             // Enregistrer une entrée de validation
//             const insertValidation =
//               'INSERT INTO page_validation (user_id, statut_validation) VALUES (?, "en_attente")';
//             db.query(insertValidation, [userId], (err) => {
//               if (err) console.error(err);
//             });

//             res.status(201).json({
//               message: 'Inscription réussie! Votre document sera vérifié.',
//               numeroCompte: numeroCompte,
//               userId: userId,
//             });
//           });
//         }
//       );
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Erreur serveur' });
//   }
// });

// // 2) LOGIN
// app.post('/api/login', (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password)
//     return res.status(400).json({ message: 'Email et mot de passe requis' });

//   const query = 'SELECT * FROM user_info WHERE email = ?';
//   db.query(query, [email], async (err, results) => {
//     if (err) {
//       console.error(err);
//       return res.status(500).json({ message: 'Erreur serveur' });
//     }
//     if (results.length === 0)
//       return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

//     const user = results[0];
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch)
//       return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

//     if (user.status === 'pending') {
//       return res.status(403).json({
//         message: 'Votre compte est en attente de validation',
//         statut: 'en_attente',
//       });
//     }
//     if (user.status === 'rejected') {
//       return res.status(403).json({
//         message: 'Votre demande a été rejetée',
//         statut: 'rejete',
//       });
//     }

//     res.json({
//       message: 'Connexion réussie',
//       userId: user.user_id,
//       numeroCompte: user.numero_de_compte,
//       statut: user.status, // 'pending', 'approved', or 'rejected'
//     });
//   });
// });

// // ... (all your remaining routes remain unchanged)

// // ------------------------------
// // Start server
// // ------------------------------
// app.listen(PORT, () => {
//   console.log(`✅ Serveur démarré sur le port ${PORT}`);
// });
