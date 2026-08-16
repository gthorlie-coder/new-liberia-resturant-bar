const pool = require('../config/db');

async function listPromotions(req, res) {
  const result = await pool.query('SELECT * FROM promotions ORDER BY starts_at DESC');
  res.json({ promotions: result.rows });
}

async function createPromotion(req, res) {
  const { code, description, discount_percent, min_orders_required, ends_at } = req.body;
  if (!code || discount_percent == null || !ends_at) {
    return res.status(400).json({ error: 'code, discount_percent, and ends_at are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO promotions (code, description, discount_percent, min_orders_required, ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [code.toUpperCase(), description || null, discount_percent, min_orders_required || 0, ends_at]
    );
    res.status(201).json({ promotion: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A promotion with this code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Could not create promotion' });
  }
}

async function updatePromotion(req, res) {
  const { id } = req.params;
  const fields = ['code', 'description', 'discount_percent', 'min_orders_required', 'ends_at', 'is_active'];
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
    `UPDATE promotions SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Promotion not found' });
  res.json({ promotion: result.rows[0] });
}

async function deletePromotion(req, res) {
  const { id } = req.params;
  await pool.query('DELETE FROM promotions WHERE id = $1', [id]);
  res.status(204).send();
}

module.exports = { listPromotions, createPromotion, updatePromotion, deletePromotion };
