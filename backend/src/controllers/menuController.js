const pool = require("../config/db");

async function listCategories(req, res, next) {
  try {
    const { branchId } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM categories WHERE branch_id = $1 ORDER BY sort_order ASC",
      [branchId]
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
}

async function listMenuItems(req, res, next) {
  try {
    const { branchId } = req.params;
    const { categoryId } = req.query;

    let query = "SELECT * FROM menu_items WHERE branch_id = $1";
    const params = [branchId];

    if (categoryId) {
      query += " AND category_id = $2";
      params.push(categoryId);
    }
    query += " ORDER BY created_at DESC";

    const { rows } = await pool.query(query, params);
    res.json({ menu_items: rows });
  } catch (err) {
    next(err);
  }
}

async function createMenuItem(req, res, next) {
  try {
    const { branch_id, category_id, name, description, price, image_url, is_alcoholic, prep_time_minutes } = req.body;

    if (!branch_id || !name || price === undefined) {
      const err = new Error("branch_id, name, and price are required");
      err.status = 400;
      throw err;
    }

    const { rows } = await pool.query(
      `INSERT INTO menu_items
        (branch_id, category_id, name, description, price, image_url, is_alcoholic, prep_time_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [branch_id, category_id || null, name, description || null, price,
       image_url || null, !!is_alcoholic, prep_time_minutes || 15]
    );

    res.status(201).json({ menu_item: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateMenuItem(req, res, next) {
  try {
    const { id } = req.params;
    const fields = ["name", "description", "price", "image_url", "is_available", "is_alcoholic", "prep_time_minutes", "category_id"];
    const updates = [];
    const values = [];
    let i = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${i}`);
        values.push(req.body[field]);
        i++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.push(`updated_at = now()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE menu_items SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );

    if (rows.length === 0) return res.status(404).json({ error: "Menu item not found" });
    res.json({ menu_item: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories, listMenuItems, createMenuItem, updateMenuItem };
