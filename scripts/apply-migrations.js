// Applies migrations from prisma/migrations to the database in DATABASE_URL.
//
//   node scripts/apply-migrations.js 7_user_profile_fields 8_refresh_token_sessions
//
// Why this exists: `prisma migrate deploy` cannot use the pooled DATABASE_URL
// this project runs on, and nothing applies migrations on deploy. Every
// migration here is written to be safe to run twice (IF NOT EXISTS), so
// re-running one that is already applied changes nothing.
//
// All the named migrations run in ONE transaction: either every one of them
// is applied, or the database is left exactly as it was.
//
// Apply a migration BEFORE starting a backend build that needs it: the
// services read the new columns as soon as they start.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

async function main() {
  const names = process.argv.slice(2);
  if (names.length === 0) {
    const available = fs.readdirSync(MIGRATIONS_DIR).filter((name) => /^\d+_/.test(name));
    console.error(`Name the migrations to apply, in order. Available:\n  ${available.join('\n  ')}`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set (see .env.example)');
  }

  // Read every file first, so a typo in a name stops before anything runs.
  const migrations = names.map((name) => ({
    name,
    sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'),
  }));

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const migration of migrations) {
      await client.query(migration.sql);
      console.log(`applied ${migration.name}`);
    }
    await client.query('COMMIT');
    console.log('done');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Nothing was changed: ${error.message}`);
  process.exit(1);
});
