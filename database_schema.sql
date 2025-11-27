-- Base de données pour la Carte Canadienne du Handicap
CREATE DATABASE IF NOT EXISTS carte_handicap_canada;
USE carte_handicap_canada;

-- Table des types de handicap
CREATE TABLE IF NOT EXISTS handicap_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    description TEXT
);

-- Table des services et accommodements
CREATE TABLE IF NOT EXISTS accommodation_info (
    accommodation_id INT PRIMARY KEY AUTO_INCREMENT,
    service_name VARCHAR(200) NOT NULL,
    service_description TEXT,
    province VARCHAR(50)
);

-- Table de liaison entre handicaps et services
CREATE TABLE IF NOT EXISTS handicap_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    handicap_type_id INT,
    accommodation_id INT,
    FOREIGN KEY (handicap_type_id) REFERENCES handicap_types(id),
    FOREIGN KEY (accommodation_id) REFERENCES accommodation_info(accommodation_id)
);

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS user_info (
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
CREATE TABLE IF NOT EXISTS user_handicaps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    handicap_type_id INT,
    FOREIGN KEY (user_id) REFERENCES user_info(user_id),
    FOREIGN KEY (handicap_type_id) REFERENCES handicap_types(id)
);

-- Table de liaison utilisateur-services
CREATE TABLE IF NOT EXISTS user_accommodation_link (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    accommodation_id INT,
    FOREIGN KEY (user_id) REFERENCES user_info(user_id),
    FOREIGN KEY (accommodation_id) REFERENCES accommodation_info(accommodation_id)
);

-- Table de validation
CREATE TABLE IF NOT EXISTS page_validation (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    statut_validation ENUM('en_attente', 'approuve', 'rejete') DEFAULT 'en_attente',
    document_verifie BOOLEAN DEFAULT FALSE,
    date_validation DATETIME,
    commentaires TEXT,
    FOREIGN KEY (user_id) REFERENCES user_info(user_id)
);

-- Table des lieux gouvernementaux par province
CREATE TABLE IF NOT EXISTS government_locations (
    location_id INT PRIMARY KEY AUTO_INCREMENT,
    province VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    location_name VARCHAR(200) NOT NULL,
    address VARCHAR(300) NOT NULL,
    phone_number VARCHAR(20),
    postal_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des rendez-vous
CREATE TABLE IF NOT EXISTS card_appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    location_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('confirme', 'annule', 'complete') DEFAULT 'confirme',
    appointment_type ENUM('nouvelle_carte', 'remplacement') NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_info(user_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES government_locations(location_id)
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

-- Liaison handicaps et services
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

-- Insérer des exemples de lieux gouvernementaux
INSERT INTO government_locations (province, city, location_name, address, phone_number, postal_code) VALUES
-- Québec - SAAQ
('Québec', 'Montréal', 'SAAQ - Centre-ville Montréal', '855 Boulevard Henri-Bourassa Ouest', '514-873-7620', 'H3C 5J9'),
('Québec', 'Montréal', 'SAAQ - Montréal-Nord', '4242 Rue de Charleroi', '514-873-7620', 'H1H 5J8'),
('Québec', 'Québec', 'SAAQ - Québec Centre', '2550 Boulevard Laurier', '418-643-7620', 'G1V 4M6'),
('Québec', 'Laval', 'SAAQ - Laval', '1515 Boulevard Chomedey', '450-686-7620', 'H7V 3Z2'),
('Québec', 'Gatineau', 'SAAQ - Gatineau', '456 Boulevard Maloney Est', '819-643-7620', 'J8P 1E6'),

-- Ontario - ServiceOntario
('Ontario', 'Toronto', 'ServiceOntario - Downtown Toronto', '777 Bay Street', '416-326-1234', 'M5G 2E5'),
('Ontario', 'Toronto', 'ServiceOntario - North York', '5650 Yonge Street', '416-326-1234', 'M2M 4G3'),
('Ontario', 'Ottawa', 'ServiceOntario - Ottawa Centre', '110 Laurier Avenue West', '613-326-1234', 'K1P 1J1'),
('Ontario', 'Mississauga', 'ServiceOntario - Mississauga', '3024 Hurontario Street', '905-326-1234', 'L5B 3B9'),
('Ontario', 'Hamilton', 'ServiceOntario - Hamilton', '119 King Street West', '905-326-1234', 'L8P 4Y7'),

-- Colombie-Britannique - ICBC
('Colombie-Britannique', 'Vancouver', 'ICBC - Downtown Vancouver', '1055 West Georgia Street', '604-661-2800', 'V6E 3P3'),
('Colombie-Britannique', 'Vancouver', 'ICBC - East Vancouver', '4680 Kingsway', '604-661-2800', 'V5H 4L9'),
('Colombie-Britannique', 'Victoria', 'ICBC - Victoria', '3995 Quadra Street', '250-978-8300', 'V8X 1J8'),
('Colombie-Britannique', 'Surrey', 'ICBC - Surrey', '6456 King George Boulevard', '604-661-2800', 'V3X 1E8'),

-- Alberta - Registry Services
('Alberta', 'Calgary', 'Alberta Registry - Calgary Centre', '801 6 Avenue SW', '403-427-2711', 'T2P 3W2'),
('Alberta', 'Calgary', 'Alberta Registry - Calgary North', '4014 Macleod Trail SE', '403-427-2711', 'T2G 2R7'),
('Alberta', 'Edmonton', 'Alberta Registry - Edmonton Downtown', '10155 102 Street NW', '780-427-2711', 'T5J 4G8'),
('Alberta', 'Edmonton', 'Alberta Registry - Edmonton South', '3803 Calgary Trail NW', '780-427-2711', 'T6J 5M8'),

-- Manitoba - Service Manitoba
('Manitoba', 'Winnipeg', 'Service Manitoba - Downtown', '1395 Ellice Avenue', '204-945-3744', 'R3G 3P2'),
('Manitoba', 'Winnipeg', 'Service Manitoba - St. Vital', '830 Dakota Street', '204-945-3744', 'R2M 5M3'),

-- Saskatchewan - SGI
('Saskatchewan', 'Regina', 'SGI - Regina Centre', '2260 11th Avenue', '306-751-1200', 'S4P 0J9'),
('Saskatchewan', 'Saskatoon', 'SGI - Saskatoon Downtown', '1134 2nd Avenue North', '306-751-1200', 'S7K 2E2'),

-- Nouveau-Brunswick - Service NB
('Nouveau-Brunswick', 'Moncton', 'Service NB - Moncton', '655 Main Street', '506-684-7901', 'E1C 1E8'),
('Nouveau-Brunswick', 'Fredericton', 'Service NB - Fredericton', '435 King Street', '506-453-2527', 'E3B 5H8'),

-- Nouvelle-Écosse - Access Nova Scotia
('Nouvelle-Écosse', 'Halifax', 'Access Nova Scotia - Halifax', '1505 Barrington Street', '902-424-5200', 'B3J 3K5'),
('Nouvelle-Écosse', 'Dartmouth', 'Access Nova Scotia - Dartmouth', '277 Pleasant Street', '902-424-5200', 'B2Y 3S4'),

-- Île-du-Prince-Édouard - Access PEI
('Île-du-Prince-Édouard', 'Charlottetown', 'Access PEI - Charlottetown', '161 St Peters Road', '902-368-5200', 'C1A 5P7'),

-- Terre-Neuve-et-Labrador - Service NL
('Terre-Neuve-et-Labrador', 'St. Johns', 'Service NL - St. Johns', '10 Mews Place', '709-729-2300', 'A1B 4J6');