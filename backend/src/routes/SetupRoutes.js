const express = require('express');
const router = express.Router();
const { runMigration, runSeed } = require('../setup/runSetup');

// One-time setup, triggered by visiting a URL in the browser instead of
// needing shell access (which Render's free tier doesn't include).
//
// Visit: https://YOUR-BACKEND-URL.onrender.com/api/setup/run?key=YOUR_SETUP_KEY
//
// Protected by SETUP_KEY so a stranger can't run this on your database —
// set SETUP_KEY in Render's Environment tab to some long random value
// before using this, and use that exact value in the URL.
router.get('/run', async (req, res) => {
  const providedKey = req.query.key;
  const expectedKey = process.env.SETUP_KEY;

  if (!expectedKey) {
    return res.status(500).json({ error: 'SETUP_KEY is not configured on the server yet. Add it in Render → Environment.' });
  }
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Missing or incorrect key.' });
  }

  try {
    const migrationResult = await runMigration();
    const seedLog = await runSeed();
    res.json({
      success: true,
      migration: migrationResult,
      seed: seedLog,
      message: 'Setup complete. You can now log in with the demo accounts listed in "seed".',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Setup failed', details: err.message });
  }
});

module.exports = router;
