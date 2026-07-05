/* =========================================================
   CARTO - Vercel serverless entry point
   The [...slug] filename makes this match every request under
   /api/*. Vercel's Node.js runtime invokes an Express app
   directly with (req, res), since Express apps are themselves
   valid (req, res) => {} handlers - no adapter/wrapper needed.
   All actual routes live in api/_app.js (kept separate so it
   can be unit-tested without pulling in Vercel's runtime).

   IMPORTANT: Vercel's Node.js runtime auto-parses request bodies
   by default, which drains the raw request stream before it
   reaches Express's own body-parser (express.json()) - causing
   corrupted/empty req.body (e.g. registration silently saving a
   wrong password hash). Disabling Vercel's bodyParser here lets
   Express read the untouched raw stream itself, as it expects to.
   ========================================================= */
import app from './_app.js';

export const config = {
  api: {
    bodyParser: false
  }
};

export default app;
