const pool = require('../config/db');

async function createOrder(req, res) {
  const userId = req.user.id;
  const { order_type, delivery_address, notes, promo_code, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch menu items to compute authoritative pricing server-side
    const itemIds = items.map((i) => i.menu_item_id);
    const menuResult = await client.query(
      'SELECT id, price, is_available FROM menu_items WHERE id = ANY($1::uuid[])',
      [itemIds]
    );
    const priceMap = {};
    menuResult.rows.forEach((row) => { priceMap[row.id] = row; });

    let subtotal = 0;
    const lineItems = items.map((i) => {
      const menuItem = priceMap[i.menu_item_id];
      if (!menuItem || !menuItem.is_available) {
        throw new Error(`Menu item ${i.menu_item_id} is unavailable`);
      }
      const quantity = i.quantity || 1;
      const line_total = Number(menuItem.price) * quantity;
      subtotal += line_total;
      return { menu_item_id: i.menu_item_id, quantity, unit_price: menuItem.price, line_total };
    });

    // Apply launch promotion discount if a valid promo code was supplied
    let discount_amount = 0;
    if (promo_code) {
      const promoResult = await client.query(
        `SELECT * FROM promotions WHERE code = $1 AND is_active = TRUE
         AND now() BETWEEN starts_at AND ends_at`,
        [promo_code]
      );
      const promo = promoResult.rows[0];
      if (promo) {
        const ordersCountResult = await client.query(
          'SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status != $2',
          [userId, 'cancelled']
        );
        const pastOrders = parseInt(ordersCountResult.rows[0].count, 10);
        if (pastOrders >= promo.min_orders_required) {
          discount_amount = Number(((subtotal * promo.discount_percent) / 100).toFixed(2));
        }
      }
    }

    const delivery_fee = order_type === 'delivery' ? 5.0 : 0; // placeholder flat fee, adjust as needed
    const total = subtotal - discount_amount + delivery_fee;

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, order_type, subtotal, discount_amount, delivery_fee, total, delivery_address, promo_code, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, order_type || 'delivery', subtotal, discount_amount, delivery_fee, total, delivery_address || null, promo_code || null, notes || null]
    );
    const order = orderResult.rows[0];

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, li.menu_item_id, li.quantity, li.unit_price, li.line_total]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ order, items: lineItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Could not create order' });
  } finally {
    client.release();
  }
}

async function listMyOrders(req, res) {
  const result = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ orders: result.rows });
}

async function getOrder(req, res) {
  const { id } = req.params;
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

  const order = orderResult.rows[0];
  if (order.user_id !== req.user.id && req.user.role === 'customer') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const itemsResult = await pool.query(
    `SELECT oi.*, mi.name FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = $1`,
    [id]
  );
  res.json({ order, items: itemsResult.rows });
}

async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const result = await pool.query(
    'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [status, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: result.rows[0] });
}

async function listAllOrders(req, res) {
  // Staff/admin need to see every incoming order, not just their own —
  // this is what the customer-facing /mine route deliberately doesn't do.
  // Items are aggregated in so the UI can show dish names without a
  // second round-trip per order.
  const { status } = req.query;
  const values = [];
  let where = '';
  if (status) {
    values.push(status);
    where = 'WHERE o.status = $1';
  }
  const result = await pool.query(
    `SELECT o.*,
            COALESCE(
              json_agg(
                json_build_object('name', mi.name, 'quantity', oi.quantity)
              ) FILTER (WHERE oi.id IS NOT NULL), '[]'
            ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     ${where}
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    values
  );
  res.json({ orders: result.rows });
}

// Orders that are ready for pickup and not yet claimed by a driver
async function listAvailableDeliveries(req, res) {
  const result = await pool.query(
    `SELECT o.*, u.full_name AS customer_name, u.phone AS customer_phone,
            COALESCE(
              json_agg(json_build_object('name', mi.name, 'quantity', oi.quantity)) FILTER (WHERE oi.id IS NOT NULL), '[]'
            ) AS items
     FROM orders o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.status = 'ready' AND o.delivery_status = 'unassigned'
     GROUP BY o.id, u.full_name, u.phone
     ORDER BY o.updated_at ASC`
  );
  res.json({ orders: result.rows });
}

// A driver accepts a ready order
async function assignDriver(req, res) {
  const { id } = req.params;
  const driverId = req.user.id;
  const result = await pool.query(
    `UPDATE orders SET assigned_driver_id = $1, delivery_status = 'accepted', updated_at = now()
     WHERE id = $2 AND delivery_status = 'unassigned' RETURNING *`,
    [driverId, id]
  );
  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'This delivery was already accepted by someone else, or is not ready yet' });
  }
  res.json({ order: result.rows[0] });
}

// Driver moves a delivery through: accepted -> picked_up -> on_the_way -> delivered
async function updateDeliveryStatus(req, res) {
  const { id } = req.params;
  const { delivery_status } = req.body;
  const valid = ['accepted', 'picked_up', 'on_the_way', 'delivered'];
  if (!valid.includes(delivery_status)) return res.status(400).json({ error: 'Invalid delivery_status' });

  const result = await pool.query(
    `UPDATE orders SET delivery_status = $1, updated_at = now(),
       status = CASE WHEN $1 = 'delivered' THEN 'delivered' ELSE status END
     WHERE id = $2 AND assigned_driver_id = $3 RETURNING *`,
    [delivery_status, id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Delivery not found or not assigned to you' });

  if (delivery_status === 'delivered') {
    await pool.query(
      `UPDATE users SET deliveries_count = deliveries_count + 1 WHERE id = $1`,
      [req.user.id]
    );
  }
  res.json({ order: result.rows[0] });
}

// A driver's own active + past deliveries
async function myDeliveries(req, res) {
  const result = await pool.query(
    `SELECT o.*, u.full_name AS customer_name,
            COALESCE(
              json_agg(json_build_object('name', mi.name, 'quantity', oi.quantity)) FILTER (WHERE oi.id IS NOT NULL), '[]'
            ) AS items
     FROM orders o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.assigned_driver_id = $1
     GROUP BY o.id, u.full_name
     ORDER BY o.updated_at DESC`,
    [req.user.id]
  );
  res.json({ orders: result.rows });
}

module.exports = { createOrder, listMyOrders, listAllOrders, getOrder, updateOrderStatus, listAvailableDeliveries, assignDriver, updateDeliveryStatus, myDeliveries };
