/* =========================================================
   Run once after db:migrate to replace the placeholder hashes
   in the seed data with real bcrypt hashes for the demo
   accounts (both use password "123456").
   Usage: DATABASE_URL=... node db/hash-demo-passwords.js
   ========================================================= */
import { Client } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();

  const hash = await bcrypt.hash('123456', 10);

  await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'user@demo.com']);
  await client.query('UPDATE sellers SET password_hash = $1 WHERE email = $2', [hash, 'admin@demo.com']);

  console.log('Demo account passwords hashed and updated (demo login: 123456).');
  await client.end();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
