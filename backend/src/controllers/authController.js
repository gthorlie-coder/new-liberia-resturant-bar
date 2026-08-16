const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

async function register(req, res) {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !phone || !password) {
    return res.status(400).json({ error: 'full_name, phone and password are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this phone number already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, phone, role, loyalty_points, created_at`,
      [full_name, email || null, phone, password_hash]
    );

    const user = result.rows[0];
    const token = signAccessToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  const { phone, email, identifier, password } = req.body;
  const lookup = identifier || phone || email;
  if (!lookup || !password) {
    return res.status(400).json({ error: 'An email or phone, and password, are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE phone = $1 OR email = $1', [lookup]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email/phone or password' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email/phone or password' });

    const token = signAccessToken(user);
    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function me(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, loyalty_points, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch profile' });
  }
}

module.exports = { register, login, me };
