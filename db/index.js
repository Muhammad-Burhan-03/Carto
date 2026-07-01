/* =========================================================
   Centralized database connection (Neon serverless + Drizzle)
   Import `db` from this file everywhere instead of creating
   new connections per function invocation.
   ========================================================= */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your Netlify environment variables ' +
    '(Site settings -> Environment variables) or your local .env file.'
  );
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
export { sql };
