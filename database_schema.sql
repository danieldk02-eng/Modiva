-- Base de données pour la Carte Canadienne du Handicap
CREATE DATABASE IF NOT EXISTS carte_handicap_canada;
USE carte_handicap_canada;

-- Table des types de handicap
CREATE TABLE handicap_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    description TEXT
);

-- Table des services et accommodements
CREATE TABLE accommodation_info (
    accommodation_id INT PRIMARY KEY AUTO_INCREMENT,
    service_name VARCHAR(200) NOT NULL,
    service_description TEXT,
    province VARCHAR(50)
);

-- Table de liaison entre handicaps et services
CREATE TABLE handicap_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    handicap_type_id INT,
    accommodation_id INT,
    FOREIGN KEY (handicap_type_id) REFERENCES handicap_types(id),
    FOREIGN KEY (accommodation_id) REFERENCES accommodation_info(accommodation_id)
);

-- Table des utilisateurs
CREATE TABLE user_info (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    address VARCHAR(255),
    numero_de_compte VARCHAR(20) UNIQUE NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    statut_validation ENUM('en_attente', 'valide', 'rejete') DEFAULT 'en_attente',
    proof_document VARCHAR(255)
);

-- Table de liaison utilisateur-handicap
CREATE TABLE user_handicaps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    handicap_type_id INT,
    FOREIGN KEY (user_id) REFERENCES user_info(user_id),
    FOREIGN KEY (handicap_type_id) REFERENCES handicap_types(id)
);

-- Table de liaison utilisateur-services
CREATE TABLE user_accommodation_link (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    accommodation_id INT,
    FOREIGN KEY (user_id) REFERENCES user_info(user_id),
    FOREIGN KEY (accommodation_id) REFERENCES accommodation_info(accommodation_id)
);

-- Table de validation
CREATE TABLE page_validation (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    statut_validation ENUM('en_attente', 'approuve', 'rejete') DEFAULT 'en_attente',
    document_verifie BOOLEAN DEFAULT FALSE,
    date_validation DATETIME,
    commentaires TEXT,
    FOREIGN KEY (user_id) REFERENCES user_info(user_id)
);

-- Insertion des types de handicap
INSERT INTO handicap_types (nom, description) VALUES
('Handicap physique - Mobilité', 'Problèmes pour se déplacer (marche, équilibre)'),
('Handicap physique - Dextérité', 'Difficultés avec les mouvements fins des mains'),
('Handicap physique - Flexibilité', 'Limitations dans l\'amplitude des mouvements'),
('Handicap sensoriel - Vue', 'Inclut la cécité et la malvoyance'),
('Handicap sensoriel - Audition', 'Inclut la surdité et la perte auditive'),
('Handicap intellectuel', 'Difficultés cognitives affectant l\'apprentissage'),
('Trouble du spectre autistique (TSA)', 'Condition neurologique affectant la communication'),
('Handicap lié à la santé mentale', 'Troubles graves de santé mentale'),
('Handicap cognitif', 'Problèmes de mémoire, d\'apprentissage et de perception'),
('Handicap lié à la douleur', 'Incapacités causées par des douleurs chroniques');

-- Insertion des services pour Handicap physique - Mobilité
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Stationnement réservé gratuit', 'Places de stationnement réservées près des entrées principales', 'Toutes les provinces'),
('Accès prioritaire aux bâtiments', 'Entrées accessibles avec rampes et boutons d\'ouverture automatique', 'Toutes les provinces'),
('Transport adapté gratuit ou réduit', 'Services de transport adapté pour déplacements', 'Toutes les provinces'),
('Aides techniques - mobilité', 'Financement pour fauteuils roulants, déambulateurs, cannes', 'Toutes les provinces'),
('Accès prioritaire files d\'attente', 'Priorité dans les files d\'attente des services publics', 'Toutes les provinces'),
('Aménagement domicile', 'Aide financière pour adapter le domicile (rampes, ascenseurs)', 'Toutes les provinces');

-- Insertion des services pour Handicap sensoriel - Vue
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Chien guide autorisé', 'Accès avec chien guide dans tous les lieux publics', 'Toutes les provinces'),
('Aides visuelles remboursées', 'Remboursement d\'aides visuelles et services de réadaptation', 'Québec'),
('Documents en braille', 'Conversion de documents en braille ou format audio', 'Toutes les provinces'),
('Logiciels de lecture d\'écran', 'Accès à des technologies d\'assistance pour la lecture', 'Toutes les provinces'),
('Accompagnateur gratuit', 'Accompagnateur admis gratuitement dans les transports et événements', 'Toutes les provinces');

-- Insertion des services pour Handicap sensoriel - Audition
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Appareils auditifs subventionnés', 'Aide financière pour prothèses auditives', 'Toutes les provinces'),
('Services d\'interprétation LSQ', 'Interprète en langue des signes québécoise disponible', 'Québec'),
('Sous-titrage obligatoire', 'Sous-titres dans les services publics et événements', 'Toutes les provinces'),
('Aides de suppléance auditive', 'Systèmes FM et autres aides techniques', 'Toutes les provinces');

-- Insertion des services pour TSA
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Services de réadaptation TSA', 'Programmes spécialisés d\'intervention précoce et soutien', 'Toutes les provinces'),
('Accompagnement scolaire adapté', 'Éducateurs spécialisés et plans d\'intervention personnalisés', 'Toutes les provinces'),
('Environnements sensoriels adaptés', 'Accès à des espaces calmes et salles sensorielles dans lieux publics', 'Toutes les provinces'),
('Soutien à l\'emploi spécialisé', 'Services d\'intégration et maintien en emploi', 'Toutes les provinces'),
('Répit et hébergement spécialisé', 'Services de répit pour familles et hébergement adapté', 'Toutes les provinces');

-- Insertion des services pour Handicap intellectuel
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Services socioprofessionnels', 'Programmes d\'activités et d\'intégration au travail adapté', 'Toutes les provinces'),
('Soutien éducatif spécialisé', 'Plans d\'intervention et ressources pédagogiques adaptées', 'Toutes les provinces'),
('Tutelle et curatelle', 'Services juridiques de protection et représentation', 'Toutes les provinces'),
('Logement supervisé', 'Résidences avec encadrement et soutien quotidien', 'Toutes les provinces'),
('Activités de loisirs adaptés', 'Programmes récréatifs et sportifs adaptés', 'Toutes les provinces');

-- Insertion des services pour Santé mentale
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Services psychiatriques gratuits', 'Accès à psychiatres et psychologues dans le réseau public', 'Toutes les provinces'),
('Accommodements au travail', 'Horaires flexibles et aménagements de poste', 'Toutes les provinces'),
('Temps supplémentaire examens', 'Temps additionnel pour évaluations scolaires et professionnelles', 'Toutes les provinces'),
('Lignes d\'écoute 24/7', 'Services de crise et soutien psychologique téléphonique', 'Toutes les provinces'),
('Hébergement en maison de transition', 'Logements supervisés pour stabilisation', 'Toutes les provinces');

-- Insertion des services pour Handicap cognitif
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Aide-mémoire et outils visuels', 'Supports visuels et rappels pour activités quotidiennes', 'Toutes les provinces'),
('Services de réadaptation cognitive', 'Thérapies et exercices pour améliorer fonctions cognitives', 'Toutes les provinces'),
('Accompagnement personnalisé', 'Support individuel pour tâches complexes et décisions', 'Toutes les provinces'),
('Technologies d\'assistance', 'Applications et dispositifs pour compenser déficits cognitifs', 'Toutes les provinces');

-- Insertion des services pour Douleur chronique
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Cliniques de gestion douleur', 'Accès à des programmes multidisciplinaires de gestion de la douleur', 'Toutes les provinces'),
('Équipement ergonomique', 'Aide pour achat de mobilier et équipement adapté', 'Toutes les provinces'),
('Pauses fréquentes autorisées', 'Droit à des pauses régulières au travail et en formation', 'Toutes les provinces'),
('Médicaments subventionnés', 'Couverture pour traitements et médicaments contre la douleur', 'Toutes les provinces'),
('Aménagement horaires', 'Flexibilité horaire pour rendez-vous médicaux fréquents', 'Toutes les provinces');

-- Insertion des services pour Dextérité
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Outils adaptés', 'Dispositifs d\'aide pour manipulation d\'objets', 'Toutes les provinces'),
('Ergothérapie subventionnée', 'Services d\'ergothérapie pour améliorer fonctions manuelles', 'Toutes les provinces'),
('Assistance pour écriture', 'Technologies vocales et logiciels de dictée', 'Toutes les provinces');

-- Insertion des services pour Flexibilité
INSERT INTO accommodation_info (service_name, service_description, province) VALUES
('Physiothérapie couverte', 'Séances de physiothérapie dans le réseau public', 'Toutes les provinces'),
('Équipement adaptatif', 'Aide pour dispositifs facilitant les mouvements', 'Toutes les provinces'),
('Aménagement poste de travail', 'Adaptation ergonomique de l\'espace de travail', 'Toutes les provinces');

-- Liaison handicaps et services (exemples)
-- Mobilité
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6);

-- Vue
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(4, 7), (4, 8), (4, 9), (4, 10), (4, 11);

-- Audition
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(5, 12), (5, 13), (5, 14), (5, 15);

-- TSA
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(7, 16), (7, 17), (7, 18), (7, 19), (7, 20);

-- Handicap intellectuel
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(6, 21), (6, 22), (6, 23), (6, 24), (6, 25);

-- Santé mentale
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(8, 26), (8, 27), (8, 28), (8, 29), (8, 30);

-- Handicap cognitif
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(9, 31), (9, 32), (9, 33), (9, 34);

-- Douleur chronique
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(10, 35), (10, 36), (10, 37), (10, 38), (10, 39);

-- Dextérité
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(2, 40), (2, 41), (2, 42);

-- Flexibilité
INSERT INTO handicap_services (handicap_type_id, accommodation_id) VALUES
(3, 43), (3, 44), (3, 45);