const pool = require('../config/db');

function withStatus(row) {
  const status = row.qty === 0 ? 'Out of Stock' : row.qty <= row.threshold ? 'Low' : 'In Stock';
  return { ...row, status };
}

async function listInventory(req, res) {
  const result = await pool.query('SELECT * FROM inventory_items ORDER BY name ASC');
  res.json({ items: result.rows.map(withStatus) });
}

async function createInventoryItem(req, res) {
  const { name, qty, unit, threshold } = req.body;
  if (!name || !unit) return res.status(400).json({ error: 'name and unit are required' });
  const result = await pool.query(
    `INSERT INTO inventory_items (name, qty, unit, threshold) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, qty || 0, unit, threshold || 0]
  );
  res.status(201).json({ item: withStatus(result.rows[0]) });
}

async function updateInventoryItem(req, res) {
  const { id } = req.params;
  const fields = ['name', 'qty', 'unit', 'threshold'];
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
    `UPDATE inventory_items SET ${updates.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Inventory item not found' });
  res.json({ item: withStatus(result.rows[0]) });
}

async function deleteInventoryItem(req, res) {
  const { id } = req.params;
  await pool.query('DELETE FROM inventory_items WHERE id = $1', [id]);
  res.status(204).send();
}

async function clearInventory(req, res) {
  await pool.query('DELETE FROM inventory_items');
  res.status(204).send();
}

module.exports = { listInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, clearInventory };
