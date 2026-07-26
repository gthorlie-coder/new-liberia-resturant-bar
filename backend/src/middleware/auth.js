const admin = require("../config/firebase");
const pool = require("../config/db");

/**
 * Verifies the Firebase bearer token and attaches the matching
 * application user (from our own `users` table) to req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE firebase_uid = $1 AND is_active = true",
      [decoded.uid]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "No matching active user account" });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Restricts a route to one or more roles, e.g. requireRole("manager", "admin")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
