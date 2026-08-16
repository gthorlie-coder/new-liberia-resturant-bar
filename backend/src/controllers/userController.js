const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const SAFE_FIELDS = `id, full_name, email, phone, role, staff_role, vehicle, work_status, rating, deliveries_count, loyalty_points, created_at`;

async function listUsersByRole(req, res) {
  const { role } = req.query; // 'staff' | 'driver' | 'customer'
  if (!['staff', 'driver', 'customer'].includes(role)) {
    return res.status(400).json({ error: "role query param must be 'staff', 'driver', or 'customer'" });
  }
  const result = await pool.query(`SELECT ${SAFE_FIELDS} FROM users WHERE role = $1 ORDER BY created_at DESC`, [role]);
  res.json({ users: result.rows });
}

// Admin creates a real staff/driver account directly — this IS the invite:
// the returned phone + temp password are what you share with that person,
// and they use those exact credentials to log in from then on.
async function createStaffOrDriver(req, res) {
  const { full_name, phone, role, staff_role, vehicle } = req.body;
  if (!full_name || !phone || !['staff', 'driver'].includes(role)) {
    return res.status(400).json({ error: 'full_name, phone, and role (staff or driver) are required' });
  }
  const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with this phone number already exists' });
  }
  const tempPassword = 'NL' + Math.floor(1000 + Math.random() * 9000) + '!';
  const password_hash = await bcrypt.hash(tempPassword, 10);
  const result = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, role, staff_role, vehicle)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${SAFE_FIELDS}`,
    [full_name, phone, password_hash, role, staff_role || null, vehicle || null]
  );
  res.status(201).json({ user: result.rows[0], tempPassword });
}

async function updateUser(req, res) {
  const { id } = req.params;
  const fields = ['full_name', 'email', 'phone', 'staff_role', 'vehicle', 'work_status'];
  const updates = [];
  const values = [];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      values.push(req.body[f]);
      updates.push(`${f} = $${values.length}`);
    }
  });
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING ${SAFE_FIELDS}`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
}

async function deleteUser(req, res) {
  const { id } = req.params;
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  res.status(204).send();
}

async function clearUsersByRole(req, res) {
  const { role } = req.query;
  if (!['staff', 'driver'].includes(role)) {
    return res.status(400).json({ error: "role query param must be 'staff' or 'driver'" });
  }
  await pool.query('DELETE FROM users WHERE role = $1', [role]);
  res.status(204).send();
}

module.exports = { listUsersByRole, createStaffOrDriver, updateUser, deleteUser, clearUsersByRole };
