// server.js - Backend Node.js pour Carte Canadienne du Handicap
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;
// Après les autres app.use


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Configuration de la base de données
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'franck911', // À changer
    database: 'carte_handicap_canada'
});

// Connexion à la base de données
db.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        return;
    }
    console.log('Connecté à la base de données MySQL');
});

// Configuration de multer pour upload de fichiers
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
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

// Fonction pour générer un numéro de compte unique
function generateAccountNumber() {
    return 'ACC' + Date.now().toString().slice(-9);
}

// ============ ROUTES API ============

// 1. INSCRIPTION
app.post('/api/inscription', upload.single('proofDocument'), async (req, res) => {
    try {
        const { prenom, nom, email, adresse, password, handicapTypes } = req.body;
        
        // Validation
        if (!prenom || !nom || !email || !password || !handicapTypes) {
            return res.status(400).json({ message: 'Tous les champs sont requis' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Document médical requis' });
        }

        // Vérifier si l'email existe déjà
        const checkEmail = 'SELECT * FROM user_info WHERE email = ?';
        db.query(checkEmail, [email], async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Erreur serveur' });
            }

            if (results.length > 0) {
                return res.status(400).json({ message: 'Cet email est déjà utilisé' });
            }

            // Hasher le mot de passe
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Générer numéro de compte
            const numeroCompte = generateAccountNumber();

            // Insérer l'utilisateur
            const insertUser = `
                INSERT INTO user_info 
                (email, password, first_name, last_name, address, numero_de_compte, proof_document, statut_validation) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')
            `;

            db.query(insertUser, [email, hashedPassword, prenom, nom, adresse, numeroCompte, req.file.filename], 
                (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ message: 'Erreur lors de l\'inscription' });
                    }

                    const userId = result.insertId;

                    // Parser les types de handicap (peut être un string ou un array)
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

                    // Insérer les types de handicap
                    const insertHandicaps = 'INSERT INTO user_handicaps (user_id, handicap_type_id) VALUES ?';
                    const handicapValues = handicapArray.map(typeId => [userId, parseInt(typeId)]);

                    db.query(insertHandicaps, [handicapValues], (err) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({ message: 'Erreur lors de l\'ajout des handicaps' });
                        }

                        // Créer entrée de validation
                        const insertValidation = 'INSERT INTO page_validation (user_id, statut_validation) VALUES (?, "en_attente")';
                        db.query(insertValidation, [userId], (err) => {
                            if (err) console.error(err);
                        });

                        res.status(201).json({
                            message: 'Inscription réussie! Votre document sera vérifié.',
                            numeroCompte: numeroCompte,
                            userId: userId
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

// 2. CONNEXION
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const query = 'SELECT * FROM user_info WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        const user = results[0];

        // Vérifier le mot de passe
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        // Vérifier le statut de validation
        if (user.statut_validation === 'en_attente') {
            return res.status(403).json({ 
                message: 'Votre compte est en attente de validation',
                statut: 'en_attente'
            });
        }

        if (user.statut_validation === 'rejete') {
            return res.status(403).json({ 
                message: 'Votre demande a été rejetée',
                statut: 'rejete'
            });
        }

        res.json({
            message: 'Connexion réussie',
            userId: user.user_id,
            numeroCompte: user.numero_de_compte,
            statut: user.statut_validation
        });
    });
});

// 3. VALIDER UN UTILISATEUR (Admin)
app.post('/api/validation/valider/:userId', (req, res) => {
    const userId = req.params.userId;
    const { approuve } = req.body; // true ou false

    const statut = approuve ? 'valide' : 'rejete';

    // Mettre à jour le statut
    const updateUser = 'UPDATE user_info SET statut_validation = ? WHERE user_id = ?';
    db.query(updateUser, [statut, userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur lors de la validation' });
        }

        const updateValidation = 'UPDATE page_validation SET statut_validation = ?, document_verifie = true, date_validation = NOW() WHERE user_id = ?';
        db.query(updateValidation, [approuve ? 'approuve' : 'rejete', userId], (err) => {
            if (err) console.error(err);
        });

        if (approuve) {
            // Assigner les services basés sur les types de handicap
            assignServicesToUser(userId);
        }

        res.json({ message: `Utilisateur ${approuve ? 'validé' : 'rejeté'} avec succès` });
    });
});

// Fonction pour assigner les services
function assignServicesToUser(userId) {
    // Récupérer les types de handicap de l'utilisateur
    const getHandicaps = 'SELECT handicap_type_id FROM user_handicaps WHERE user_id = ?';
    
    db.query(getHandicaps, [userId], (err, handicaps) => {
        if (err) {
            console.error(err);
            return;
        }

        // Pour chaque type de handicap, récupérer les services associés
        handicaps.forEach(h => {
            const getServices = 'SELECT accommodation_id FROM handicap_services WHERE handicap_type_id = ?';
            
            db.query(getServices, [h.handicap_type_id], (err, services) => {
                if (err) {
                    console.error(err);
                    return;
                }

                // Insérer les liens user-service
                if (services.length > 0) {
                    const insertLinks = 'INSERT INTO user_accommodation_link (user_id, accommodation_id) VALUES ?';
                    const values = services.map(s => [userId, s.accommodation_id]);
                    
                    db.query(insertLinks, [values], (err) => {
                        if (err) console.error(err);
                    });
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
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json(results[0]);
    });
});

// 5. OBTENIR SERVICES D'UN UTILISATEUR
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
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        res.json(results);
    });
});

// 6. VÉRIFIER ACCOMMODEMENTS PAR NUMÉRO DE COMPTE (pour employés)
app.get('/api/verify/:numeroCompte', (req, res) => {
    const numeroCompte = req.params.numeroCompte;

    const query = `
        SELECT u.first_name, u.last_name, u.numero_de_compte, u.statut_validation
        FROM user_info u
        WHERE u.numero_de_compte = ?
    `;

    db.query(query, [numeroCompte], (err, userResults) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if (userResults.length === 0) {
            return res.status(404).json({ message: 'Numéro de compte non trouvé' });
        }

        const user = userResults[0];

        if (user.statut_validation !== 'valide') {
            return res.status(403).json({ message: 'Compte non validé' });
        }

        // Récupérer les services
        const servicesQuery = `
            SELECT DISTINCT a.service_name, a.service_description, a.province
            FROM user_info u
            JOIN user_accommodation_link ual ON u.user_id = ual.user_id
            JOIN accommodation_info a ON ual.accommodation_id = a.accommodation_id
            WHERE u.numero_de_compte = ?
            ORDER BY a.service_name
        `;

        db.query(servicesQuery, [numeroCompte], (err, services) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Erreur serveur' });
            }

            res.json({
                user: {
                    firstName: user.first_name,
                    lastName: user.last_name,
                    numeroCompte: user.numero_de_compte
                },
                services: services
            });
        });
    });
});

// 7. LISTE DES UTILISATEURS EN ATTENTE (Admin)
app.get('/api/admin/pending-users', (req, res) => {
    const query = `
        SELECT u.user_id, u.first_name, u.last_name, u.email, u.date_creation, u.proof_document
        FROM user_info u
        WHERE u.statut_validation = 'en_attente'
        ORDER BY u.date_creation DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        res.json(results);
    });
});
// CHECK RFID
// Sa va retourner { access: "GRANTED"|"DENIED", name: "First Last", reason?: "...", disability_category?: "..." }
app.post('/check', (req, res) => {
  const uidRaw = (req.body && req.body.uid) ? String(req.body.uid) : '';
  const uid = uidRaw.trim().toUpperCase();
  if (!uid) return res.status(400).json({ access: 'DENIED', reason: 'no_uid' });

  // Look up by UID, join to user to get name + validation status, this expects a table "rfid_cards" that links a card UID to a user
  const sql = `
    SELECT 
      c.uid,
      c.active,
      c.expires_at,
      u.first_name,
      u.last_name,
      u.statut_validation
    FROM rfid_cards c
    LEFT JOIN user_info u ON u.user_id = c.user_id
    WHERE UPPER(c.uid) = ? 
    LIMIT 1
  `;

  db.query(sql, [uid], (err, rows) => {
    if (err) {
      console.error('DB error /check:', err);
      return res.status(500).json({ access: 'DENIED', reason: 'db_error' });
    }
    if (!rows || rows.length === 0) {
      return res.json({ access: 'DENIED', name: '', reason: 'unknown_uid' });
    }

    const r = rows[0];
    const now = new Date();
    const notExpired = !r.expires_at || new Date(r.expires_at) > now;
    const isActive = !!r.active;
    const isValidated = r.statut_validation === 'valide';

    const granted = isActive && notExpired && isValidated;

    return res.json({
      access: granted ? 'GRANTED' : 'DENIED',
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      // you can add disability_category later with an extra JOIN if needed
      reason: granted ? undefined : (!isActive ? 'inactive_card' : (!notExpired ? 'expired' : (!isValidated ? 'not_validated' : 'denied')))
    });
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
