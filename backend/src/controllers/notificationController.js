const pool = require('../config/db');

async function listNotifications(req, res) {
  const result = await pool.query('SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 50');
  res.json({ notifications: result.rows });
}

async function sendNotification(req, res) {
  const { title, message, audience } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message are required' });
  const result = await pool.query(
    `INSERT INTO notifications (title, message, audience) VALUES ($1, $2, $3) RETURNING *`,
    [title, message, audience || 'all']
  );
  res.status(201).json({ notification: result.rows[0] });
}

module.exports = { listNotifications, sendNotification };
