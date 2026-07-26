const { v4: uuidv4 } = require("uuid");
const admin = require("../config/firebase");
const pool = require("../config/db");

/**
 * Called right after a client signs in with Firebase (phone/OTP, Google, or Apple).
 * Verifies the token, then creates the app-level user record on first login,
 * or returns the existing one.
 */
async function syncUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const decoded = await admin.auth().verifyIdToken(token);
    const { full_name } = req.body;

    const existing = await pool.query("SELECT * FROM users WHERE firebase_uid = $1", [decoded.uid]);
    if (existing.rows.length > 0) {
      return res.json({ user: existing.rows[0], created: false });
    }

    const provider = decoded.firebase && decoded.firebase.sign_in_provider;
    const authProvider = provider === "google.com" ? "google"
      : provider === "apple.com" ? "apple"
      : decoded.phone_number ? "phone"
      : "email";

    const qrCode = `NLR-${uuidv4().split("-")[0].toUpperCase()}`;

    const inserted = await pool.query(
      `INSERT INTO users (full_name, phone, email, firebase_uid, auth_provider, qr_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        full_name || decoded.name || "New Customer",
        decoded.phone_number || null,
        decoded.email || null,
        decoded.uid,
        authProvider,
        qrCode,
      ]
    );

    // Every new customer gets a loyalty account starting at Silver tier.
    await pool.query(
      `INSERT INTO loyalty_accounts (user_id, referral_code) VALUES ($1, $2)`,
      [inserted.rows[0].id, `REF-${uuidv4().split("-")[0].toUpperCase()}`]
    );

    res.status(201).json({ user: inserted.rows[0], created: true });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { syncUser, me };
