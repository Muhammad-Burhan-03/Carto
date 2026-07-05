/* =========================================================
   CARTO - Vercel serverless entry point
   The [...slug] filename makes this match every request under
   /api/*. Vercel's Node.js runtime invokes an Express app
   directly with (req, res), since Express apps are themselves
   valid (req, res) => {} handlers - no adapter/wrapper needed.
   All actual routes live in api/_app.js (kept separate so it
   can be unit-tested without pulling in Vercel's runtime).
   ========================================================= */
import app from './_app.js';

export default app;
