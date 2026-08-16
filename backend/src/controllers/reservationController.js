const pool = require('../config/db');

async function listReservations(req, res) {
  const result = await pool.query('SELECT * FROM reservations ORDER BY reservation_time ASC');
  res.json({ reservations: result.rows });
}

async function createReservation(req, res) {
  const { reservation_type, customer_name, phone, party_size, reservation_time, notes } = req.body;
  if (!customer_name || !reservation_time) {
    return res.status(400).json({ error: 'customer_name and reservation_time are required' });
  }
  const result = await pool.query(
    `INSERT INTO reservations (user_id, reservation_type, customer_name, phone, party_size, reservation_time, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user?.id || null, reservation_type || 'table', customer_name, phone || null, party_size || 1, reservation_time, notes || null]
  );
  res.status(201).json({ reservation: result.rows[0] });
}

async function updateReservationStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const result = await pool.query(
    'UPDATE reservations SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Reservation not found' });
  res.json({ reservation: result.rows[0] });
}

module.exports = { listReservations, createReservation, updateReservationStatus };
