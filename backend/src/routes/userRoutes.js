const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin'), userController.listUsersByRole);
router.post('/', authenticate, authorize('admin'), userController.createStaffOrDriver);
router.patch('/:id', authenticate, authorize('admin'), userController.updateUser);
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);
router.delete('/', authenticate, authorize('admin'), userController.clearUsersByRole);

module.exports = router;
