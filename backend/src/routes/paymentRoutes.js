const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, paymentController.initiatePayment);
router.get('/:id/status', authenticate, paymentController.checkPaymentStatus);
router.post('/:id/confirm-cash', authenticate, authorize('admin', 'staff'), paymentController.confirmCashPayment);
router.get('/order/:order_id', authenticate, paymentController.getPaymentsForOrder);

// Provider webhooks — no auth middleware, since MTN/Orange call these
// directly, not a logged-in user. Register these exact URLs with each
// provider when your merchant account is set up.
router.post('/webhooks/mtn', paymentController.mtnWebhook);
router.post('/webhooks/orange', paymentController.orangeWebhook);

module.exports = router;
