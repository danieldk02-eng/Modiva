// server.js - Backend for Carte Canadienne du Handicap

import express from "express";
import mysql from "mysql2";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// ---------------- File Uploads ----------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ---------------- Database ----------------
const db = mysql.createConnection({
  host: process.env.MYSQLHOST || "mysql.railway.internal",
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT || 3306,
});

db.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données:", err);
    process.exit(1);
  } else {
    console.log("✅ Connecté à la base de données MySQL sur Railway");
  }
});

// ---------------- Routes ----------------

// Root
app.get("/", (req, res) => {
  res.send("API Carte Canadienne du Handicap - Backend en ligne");
});

// 1️⃣ Register a new user
app.post("/register", async (req, res) => {
  const { name, email, password, disability_category } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (name, email, password, disability_category, approved) VALUES (?, ?, ?, ?, 0)",
      [name, email, hashedPassword, disability_category],
      (err) => {
        if (err) {
          console.error("Erreur lors de l'inscription:", err);
          return res.status(500).json({ error: "Erreur serveur" });
        }
        res.status(201).json({ message: "Utilisateur enregistré avec succès" });
      }
    );
  } catch (error) {
    console.error("Erreur inattendue lors de l'inscription:", error);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// 2️⃣ Approve a user and automatically assign a free card
app.post("/approve-user", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID requis" });
  }

  // Find first unassigned card
  const findCard = "SELECT uid FROM cards WHERE assigned = 0 LIMIT 1";
  db.query(findCard, (err, cardResults) => {
    if (err) {
      console.error("Erreur lors de la recherche de carte:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    if (cardResults.length === 0) {
      return res.status(400).json({ error: "Aucune carte disponible" });
    }

    const cardUID = cardResults[0].uid;

    // Assign UID to user and mark approved
    const assignUser = "UPDATE users SET uid = ?, approved = 1 WHERE id = ?";
    db.query(assignUser, [cardUID, userId], (err) => {
      if (err) {
        console.error("Erreur lors de la mise à jour de l'utilisateur:", err);
        return res.status(500).json({ error: "Erreur serveur" });
      }

      // Mark card as assigned
      const markCard = "UPDATE cards SET assigned = 1 WHERE uid = ?";
      db.query(markCard, [cardUID], (err) => {
        if (err) {
          console.error("Erreur lors de la mise à jour de la carte:", err);
          return res.status(500).json({ error: "Erreur serveur" });
        }

        res.json({
          success: true,
          message: "Utilisateur approuvé et carte assignée",
          uid: cardUID,
        });
      });
    });
  });
});

// 3️⃣ Arduino RFID scan verification
app.post("/scan", (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ access: "DENIED", message: "UID manquant" });
  }

  const query = "SELECT name, disability_category, approved FROM users WHERE uid = ?";
  db.query(query, [uid], (err, results) => {
    if (err) {
      console.error("Erreur lors de la vérification de l'UID:", err);
      return res.status(500).json({ access: "DENIED", error: "Erreur serveur" });
    }

    if (results.length > 0 && results[0].approved) {
      const user = results[0];
      res.json({
        access: "GRANTED",
        name: user.name,
        disability_category: user.disability_category,
      });
    } else {
      res.json({ access: "DENIED", name: "Inconnu" });
    }
  });
});

// Health check (Railway)
app.get("/health", (req, res) => {
  db.ping((err) => {
    if (err) return res.status(500).json({ status: "Database unreachable" });
    res.json({ status: "OK" });
  });
});

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
