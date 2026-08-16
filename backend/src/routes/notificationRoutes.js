const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin'), notificationController.listNotifications);
router.post('/', authenticate, authorize('admin'), notificationController.sendNotification);

module.exports = router;
