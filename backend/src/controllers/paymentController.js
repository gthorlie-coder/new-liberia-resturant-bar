const pool = require("../config/db");

/**
 * NOTE: The charge functions below record the payment attempt and mark it
 * "pending", then would call out to the real provider SDK/API. Wire in
 * Orange Money Liberia's and Lonestar MTN MoMo's actual APIs here once
 * sandbox credentials are available — this keeps the rest of the app
 * (order status, receipts, refunds) fully working against a stable interface
 * regardless of which provider is behind it.
 */
async function initiateCharge(method) {
  return async function (req, res, next) {
    try {
      const { order_id, amount } = req.body;
      if (!order_id || !amount) {
        return res.status(400).json({ error: "order_id and amount are required" });
      }

      const orderCheck = await pool.query("SELECT id, total FROM orders WHERE id = $1", [order_id]);
      if (orderCheck.rows.length === 0) return res.status(404).json({ error: "Order not found" });

      const { rows } = await pool.query(
        `INSERT INTO payments (order_id, method, status, amount)
         VALUES ($1, $2, 'pending', $3)
         RETURNING *`,
        [order_id, method, amount]
      );

      // TODO: call provider API (Orange Money / Lonestar MoMo / card processor) here,
      // then update this payment's status + transaction_ref via a webhook or callback.

      res.status(202).json({
        payment: rows[0],
        message: `Charge initiated via ${method}. Awaiting provider confirmation.`,
      });
    } catch (err) {
      next(err);
    }
  };
}

async function refundPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "UPDATE payments SET status = 'refunded' WHERE id = $1 RETURNING *",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Payment not found" });

    await pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id)
       VALUES ($1, 'refund_issued', 'payment', $2)`,
      [req.user.id, id]
    );

    res.json({ payment: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiateCharge, refundPayment };
