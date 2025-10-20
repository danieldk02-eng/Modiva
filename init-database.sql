// init-database.js - Script pour initialiser automatiquement la base de données
const mysql = require('mysql2/promise');
const fs = require('fs');

// Configuration de connexion MySQL (SANS spécifier la database)
const config = {
    host: 'localhost',
    user: 'root',
    password: 'votre_mot_de_passe', // À changer par chaque utilisateur
    multipleStatements: true // Permet d'exécuter plusieurs requêtes SQL
};

async function initDatabase() {
    let connection;
    
    try {
        console.log(' Connexion à MySQL...');
        connection = await mysql.createConnection(config);
        console.log(' Connecté à MySQL');

        // Vérifier si la base de données existe
        const [databases] = await connection.query(
            "SHOW DATABASES LIKE 'carte_handicap_canada'"
        );

        if (databases.length > 0) {
            console.log('  La base de données existe déjà');
            await connection.end();
            return;
        }

        console.log(' Création de la base de données...');

        // Lire le fichier SQL
        const sqlScript = fs.readFileSync('./database_schema.sql', 'utf8');

        // Exécuter le script SQL
        await connection.query(sqlScript);

        console.log(' Base de données créée avec succès!');
        console.log(' Tables créées');
        console.log(' Données initiales insérées');
        console.log('');
        console.log(' Initialisation terminée! Vous pouvez maintenant lancer: npm start');

    } catch (error) {
        console.error(' Erreur lors de l\'initialisation:', error.message);
        console.log('');
        console.log(' Vérifiez:');
        console.log('   1. MySQL est démarré');
        console.log('   2. Le mot de passe dans init-database.js est correct');
        console.log('   3. L\'utilisateur root a les permissions nécessaires');
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Exécuter le script
initDatabase();