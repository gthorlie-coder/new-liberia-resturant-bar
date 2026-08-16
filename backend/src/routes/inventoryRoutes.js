const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'staff'), inventoryController.listInventory);
router.post('/', authenticate, authorize('admin', 'staff'), inventoryController.createInventoryItem);
router.patch('/:id', authenticate, authorize('admin', 'staff'), inventoryController.updateInventoryItem);
router.delete('/:id', authenticate, authorize('admin'), inventoryController.deleteInventoryItem);
router.delete('/', authenticate, authorize('admin'), inventoryController.clearInventory);

module.exports = router;
