const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || './melotones.db';
const db = new Database(dbPath);

// Lire et exécuter le schéma
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
console.log('✅ Tables créées/vérifiées');

// Créer un utilisateur de test (si la table est vide)
const user = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!user) {
  const insert = db.prepare(
    `INSERT INTO users (credits, email) VALUES (?, ?)`
  );
  insert.run(100, 'test@melotones.com');
  console.log('✅ Utilisateur test créé (id=1, credits=100)');
} else {
  console.log(`ℹ️  Utilisateur existant trouvé (id=${user.id})`);
}

console.log('✅ Base de données prête');
db.close();
