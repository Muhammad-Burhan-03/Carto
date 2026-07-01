/* =========================================================
   Simple migration runner.
   Usage: DATABASE_URL=... node db/migrate.js
   Applies every .sql file in db/migrations in filename order,
   tracking applied migrations in a `_migrations` table so it
   is safe to run repeatedly (idempotent).
   ========================================================= */
import { Client } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new Client(process.env.DATABASE_URL);
  await client.connect();

  await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT now()
  )`);

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const already = await client.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if (already.rows.length > 0) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`apply ${file} ...`);
    await client.query(content);
    await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    console.log(`done  ${file}`);
  }

  await client.end();
  console.log('All migrations applied.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
