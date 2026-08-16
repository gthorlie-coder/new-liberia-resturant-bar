const pool = require('../config/db');

async function listCategories(req, res) {
  const result = await pool.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
  res.json({ categories: result.rows });
}

async function createCategory(req, res) {
  const { name, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    `INSERT INTO menu_categories (name, sort_order) VALUES ($1, $2) RETURNING *`,
    [name, sort_order || 0]
  );
  res.status(201).json({ category: result.rows[0] });
}

async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, sort_order } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) { values.push(name); updates.push(`name = $${values.length}`); }
  if (sort_order !== undefined) { values.push(sort_order); updates.push(`sort_order = $${values.length}`); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const result = await pool.query(
    `UPDATE menu_categories SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
  res.json({ category: result.rows[0] });
}

async function deleteCategory(req, res) {
  const { id } = req.params;
  await pool.query('DELETE FROM menu_categories WHERE id = $1', [id]);
  res.status(204).send();
}

async function listMenuItems(req, res) {
  const { category_id, available_only } = req.query;
  const conditions = [];
  const values = [];

  if (category_id) {
    values.push(category_id);
    conditions.push(`category_id = $${values.length}`);
  }
  if (available_only === 'true') {
    conditions.push('is_available = TRUE');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM menu_items ${where} ORDER BY created_at DESC`,
    values
  );
  res.json({ items: result.rows });
}

async function createMenuItem(req, res) {
  const { category_id, name, description, price, image_url, is_drink } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'name and price are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO menu_items (category_id, name, description, price, image_url, is_drink)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [category_id || null, name, description || null, price, image_url || null, !!is_drink]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create menu item' });
  }
}

async function updateMenuItem(req, res) {
  const { id } = req.params;
  const fields = ['category_id', 'name', 'description', 'price', 'image_url', 'is_available', 'is_drink'];
  const updates = [];
  const values = [];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
  });

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE menu_items SET ${updates.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update menu item' });
  }
}

async function deleteMenuItem(req, res) {
  const { id } = req.params;
  await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
  res.status(204).send();
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem };
