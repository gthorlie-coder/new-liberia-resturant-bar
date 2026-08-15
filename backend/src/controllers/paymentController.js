const pool = require('../config/db');
const mtnMomo = require('../services/mtnMomoService');
const orangeMoney = require('../services/orangeMoneyService');

// Card payments (Visa/Mastercard) still need a processor like Stripe or
// Flutterwave wired in here the same way — see the two mobile money
// services for the pattern to follow.
async function callCardProcessor(amount, meta) {
  return { success: true, provider_ref: `SIMULATED-CARD-${Date.now()}` };
}

async function initiatePayment(req, res) {
  const { order_id, method, payer_phone } = req.body;
  const validMethods = ['orange_money', 'lonestar_momo', 'visa', 'mastercard', 'cash'];
  if (!order_id || !validMethods.includes(method)) {
    return res.status(400).json({ error: 'order_id and a valid method are required' });
  }
  if ((method === 'orange_money' || method === 'lonestar_momo') && !payer_phone) {
    return res.status(400).json({ error: 'payer_phone is required for mobile money payments' });
  }

  try {
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const paymentResult = await pool.query(
      `INSERT INTO payments (order_id, method, amount, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [order_id, method, order.total]
    );
    const payment = paymentResult.rows[0];

    // Cash: nothing to call, stays pending until confirmed at delivery/pickup.
    if (method === 'cash') {
      return res.status(201).json({ payment });
    }

    // Cards: synchronous processors normally return an immediate result.
    if (method === 'visa' || method === 'mastercard') {
      const result = await callCardProcessor(order.total, { order_id });
      const status = result.success ? 'paid' : 'failed';
      const updated = await pool.query(
        `UPDATE payments SET status = $1, provider_ref = $2, paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE NULL END
         WHERE id = $3 RETURNING *`,
        [status, result.provider_ref, payment.id]
      );
      if (status === 'paid') {
        await pool.query(`UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1`, [order_id]);
      }
      return res.status(201).json({ payment: updated.rows[0] });
    }

    // Mobile money: this only SENDS the prompt to the customer's phone.
    // The customer still has to approve it there — so we stay 'pending'
    // and store the provider's reference so the webhook (or a status
    // poll) can match it back to this payment and flip it to 'paid'.
    let providerRef;
    if (method === 'lonestar_momo') {
      const result = await mtnMomo.requestToPay({
        amount: order.total,
        phone: payer_phone,
        externalId: order_id,
        payerMessage: `New Liberia order ${order_id}`,
      });
      providerRef = result.referenceId;
    } else if (method === 'orange_money') {
      const result = await orangeMoney.initiatePayment({
        amount: order.total,
        phone: payer_phone,
        orderId: order_id,
      });
      providerRef = result.payToken;
    }

    const updated = await pool.query(
      `UPDATE payments SET provider_ref = $1 WHERE id = $2 RETURNING *`,
      [providerRef, payment.id]
    );

    res.status(201).json({
      payment: updated.rows[0],
      message: 'Payment request sent — ask the customer to approve it on their phone.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
}

// Called by your frontend to check whether a pending mobile money payment
// has been approved yet — useful since webhooks need a public callback URL
// and can be delayed. Polling every few seconds is a reasonable fallback.
async function checkPaymentStatus(req, res) {
  const { id } = req.params; // payment id
  try {
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    const payment = result.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.json({ payment });

    let providerStatus;
    if (payment.method === 'lonestar_momo') {
      const s = await mtnMomo.checkStatus(payment.provider_ref);
      providerStatus = s.status === 'SUCCESSFUL' ? 'paid' : s.status === 'FAILED' ? 'failed' : 'pending';
    } else if (payment.method === 'orange_money') {
      const s = await orangeMoney.checkStatus(payment.order_id, payment.provider_ref);
      providerStatus = s.status === 'SUCCESS' ? 'paid' : s.status === 'FAILED' ? 'failed' : 'pending';
    } else {
      return res.json({ payment });
    }

    if (providerStatus !== 'pending') {
      const updated = await pool.query(
        `UPDATE payments SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE NULL END WHERE id = $2 RETURNING *`,
        [providerStatus, id]
      );
      if (providerStatus === 'paid') {
        await pool.query(`UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1`, [payment.order_id]);
      }
      return res.json({ payment: updated.rows[0] });
    }

    res.json({ payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not check payment status' });
  }
}

// Webhook endpoints — MTN and Orange call these when a customer approves or
// declines a payment. Register these URLs with each provider when your
// merchant account is set up (e.g. https://yourapi.com/api/payments/webhooks/mtn).
//
// SECURITY: we deliberately do NOT trust the webhook body for the payment
// result. Anyone can POST to a public URL and claim "SUCCESSFUL" — that
// would let a stranger mark any order as paid for free. Instead, the
// webhook is only a trigger: we take the reference it gives us and ask
// MTN/Orange's own authenticated API what actually happened, then update
// the database from THAT answer. A forged webhook call just triggers a
// harmless re-check, it can't force a fake "paid" result.
//
// As defense-in-depth, also set WEBHOOK_SHARED_SECRET in your env and
// configure the same value in each provider's webhook/notification URL
// settings if they support a shared-secret query param or header — this
// rejects obviously unauthorized callers before we even touch the database.
function verifyWebhookSecret(req) {
  const expected = process.env.WEBHOOK_SHARED_SECRET;
  if (!expected) return true; // not configured yet — skip this layer, rely on the re-check above
  const provided = req.headers['x-webhook-secret'] || req.query.secret;
  return provided === expected;
}

async function mtnWebhook(req, res) {
  try {
    if (!verifyWebhookSecret(req)) return res.sendStatus(401);

    const { referenceId } = req.body;
    if (!referenceId) return res.status(400).json({ error: 'referenceId is required' });

    // Ask MTN directly what really happened — ignore any status the caller claimed.
    const real = await mtnMomo.checkStatus(referenceId);
    const mapped = real.status === 'SUCCESSFUL' ? 'paid' : real.status === 'FAILED' ? 'failed' : 'pending';

    const result = await pool.query(
      `UPDATE payments SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE NULL END WHERE provider_ref = $2 RETURNING *`,
      [mapped, referenceId]
    );
    if (result.rows[0] && mapped === 'paid') {
      await pool.query(`UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1`, [result.rows[0].order_id]);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

async function orangeWebhook(req, res) {
  try {
    if (!verifyWebhookSecret(req)) return res.sendStatus(401);

    const { pay_token, order_id } = req.body;
    if (!pay_token || !order_id) return res.status(400).json({ error: 'pay_token and order_id are required' });

    // Ask Orange directly what really happened — ignore any status the caller claimed.
    const real = await orangeMoney.checkStatus(order_id, pay_token);
    const mapped = real.status === 'SUCCESS' ? 'paid' : real.status === 'FAILED' ? 'failed' : 'pending';

    const result = await pool.query(
      `UPDATE payments SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE NULL END WHERE provider_ref = $2 RETURNING *`,
      [mapped, pay_token]
    );
    if (result.rows[0] && mapped === 'paid') {
      await pool.query(`UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1`, [result.rows[0].order_id]);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

async function confirmCashPayment(req, res) {
  const { id } = req.params;
  const result = await pool.query(
    `UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1 AND method = 'cash' RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Cash payment not found' });

  await pool.query(`UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1`, [result.rows[0].order_id]);
  res.json({ payment: result.rows[0] });
}

async function getPaymentsForOrder(req, res) {
  const { order_id } = req.params;
  const result = await pool.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC', [order_id]);
  res.json({ payments: result.rows });
}

module.exports = {
  initiatePayment,
  checkPaymentStatus,
  mtnWebhook,
  orangeWebhook,
  confirmCashPayment,
  getPaymentsForOrder,
};
