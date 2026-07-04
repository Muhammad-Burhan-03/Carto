/* =========================================================
   Centralized database connection (Neon serverless + Drizzle)
   Import `db` from this file everywhere instead of creating
   new connections per function invocation.
   ========================================================= */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// On Netlify, @netlify/database auto-provisions a Postgres instance (Neon
// under the hood) and injects its connection string automatically — no
// manual setup required. We fall back to a manually-configured DATABASE_URL
// for local development or if you'd rather point at your own Postgres/Neon
// instance instead of Netlify Database.
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  try {
    const { getConnectionString } = await import('@netlify/database');
    connectionString = getConnectionString();
  } catch { /* @netlify/database not available in this environment */ }
}

if (!connectionString) {
  throw new Error(
    'No database connection string available. On Netlify, install/deploy with ' +
    '@netlify/database for automatic provisioning, or set DATABASE_URL manually ' +
    'in your environment variables.'
  );
}

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
export { sql };
