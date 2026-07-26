const pool = require("../config/db");

const TAX_RATE = 0.0; // adjust to Liberia's applicable rate once finalized

async function createOrder(req, res, next) {
  const client = await pool.connect();
  try {
    const { branch_id, type, items, table_id, scheduled_for, tip } = req.body;

    if (!branch_id || !Array.isArray(items) || items.length === 0) {
      const err = new Error("branch_id and a non-empty items array are required");
      err.status = 400;
      throw err;
    }

    await client.query("BEGIN");

    // Price each line item from the current menu price — never trust client-sent prices.
    let subtotal = 0;
    const priced = [];
    for (const item of items) {
      const { rows } = await client.query(
        "SELECT id, price, is_available FROM menu_items WHERE id = $1 AND branch_id = $2",
        [item.menu_item_id, branch_id]
      );
      if (rows.length === 0) throw Object.assign(new Error(`Menu item ${item.menu_item_id} not found`), { status: 400 });
      if (!rows[0].is_available) throw Object.assign(new Error(`Menu item ${item.menu_item_id} is out of stock`), { status: 400 });

      const unitPrice = parseFloat(rows[0].price);
      const qty = item.quantity || 1;
      subtotal += unitPrice * qty;
      priced.push({ ...item, unit_price: unitPrice, quantity: qty });
    }

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax + (tip || 0);

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, branch_id, type, subtotal, tax, tip, total, table_id, scheduled_for)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [req.user.id, branch_id, type || "delivery", subtotal, tax, tip || 0, total, table_id || null, scheduled_for || null]
    );
    const order = orderResult.rows[0];

    for (const item of priced) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, customizations, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.menu_item_id, item.quantity, JSON.stringify(item.customizations || []), item.unit_price]
      );
    }

    // Delivery orders automatically get a delivery record to track later.
    if ((type || "delivery") === "delivery") {
      await client.query(`INSERT INTO deliveries (order_id) VALUES ($1)`, [order.id]);
    }

    await client.query("COMMIT");
    res.status(201).json({ order });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

async function getOrder(req, res, next) {
  try {
    const { id } = req.params;
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const itemsResult = await pool.query(
      `SELECT oi.*, mi.name, mi.image_url
       FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = $1`,
      [id]
    );

    res.json({ order: orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    next(err);
  }
}

async function listUserOrders(req, res, next) {
  try {
    const { userId } = req.params;
    // Customers may only view their own history; staff roles can view anyone's.
    if (req.user.id !== userId && !["manager", "admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [userId]
    );
    res.json({ orders: rows });
  } catch (err) {
    next(err);
  }
}

// Used by the Kitchen Display, Bar Display, and rider apps to move an order/item along.
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ["received", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const { rows } = await pool.query(
      "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Order not found" });

    res.json({ order: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, getOrder, listUserOrders, updateOrderStatus };
