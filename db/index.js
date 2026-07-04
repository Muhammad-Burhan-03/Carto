/* =========================================================
   Centralized database connection (Neon serverless + Drizzle)
   Import `db` from this file everywhere instead of creating
   new connections per function invocation.
   ========================================================= */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// Support DATABASE_URL directly (manual Neon setup) as well as the
// variable names Vercel's Neon marketplace integration injects
// automatically when you connect a database via the Storage tab.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    'No database connection string found. Set DATABASE_URL in your ' +
    'Vercel project environment variables (Settings -> Environment Variables), ' +
    'or connect a Neon database via the Storage tab.'
  );
}

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
export { sql };
