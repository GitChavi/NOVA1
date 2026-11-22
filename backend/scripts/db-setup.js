// Prepara la base de datos de punta a punta: crea nova_db si no existe,
// aplica el esquema, la migracion de persistencia dual y (opcional) los datos demo.
// Uso: npm run db:setup         -> esquema + migracion + seeds
//      npm run db:setup -- --no-seed
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlDir = path.join(__dirname, '..', 'SQL');
const withSeed = !process.argv.includes('--no-seed');
const files = ['02_schema.sql', '03_persistencia_dual.sql', ...(withSeed ? ['04_seed.sql'] : [])];

function connectionConfig(database) {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined };
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

async function ensureDatabase() {
  if (process.env.DATABASE_URL) return; // en la nube la base ya existe
  const name = process.env.DB_NAME;
  if (!/^[a-z_][a-z0-9_]*$/i.test(name || '')) throw new Error('DB_NAME no es un nombre valido.');
  const admin = new Client(connectionConfig('postgres'));
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE ${name}`);
      console.log(`Base de datos ${name} creada.`);
    }
  } finally {
    await admin.end();
  }
}

(async () => {
  await ensureDatabase();
  const client = new Client(connectionConfig(process.env.DB_NAME));
  await client.connect();
  try {
    for (const file of files) {
      // replace: algunos editores de Windows guardan el SQL con BOM y PostgreSQL no lo acepta.
      await client.query(fs.readFileSync(path.join(sqlDir, file), 'utf8').replace(/^﻿/, ''));
      console.log(`OK  ${file}`);
    }
    console.log(withSeed ? 'Listo. Cuentas demo con contrasena Nova2026: empresa@nova.demo, andina@nova.demo, candidato@nova.demo' : 'Listo.');
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error('No se pudo preparar la base de datos:', error.message);
  process.exit(1);
});
