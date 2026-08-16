const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, orderController.createOrder);
router.get('/mine', authenticate, orderController.listMyOrders);
router.get('/available-deliveries', authenticate, authorize('driver'), orderController.listAvailableDeliveries);
router.get('/my-deliveries', authenticate, authorize('driver'), orderController.myDeliveries);
router.post('/:id/assign-driver', authenticate, authorize('driver'), orderController.assignDriver);
router.patch('/:id/delivery-status', authenticate, authorize('driver'), orderController.updateDeliveryStatus);
router.get('/', authenticate, authorize('admin', 'staff'), orderController.listAllOrders);
router.get('/:id', authenticate, orderController.getOrder);
router.patch('/:id/status', authenticate, authorize('admin', 'staff'), orderController.updateOrderStatus);

module.exports = router;
