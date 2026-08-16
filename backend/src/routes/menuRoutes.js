const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/categories', menuController.listCategories);
router.get('/items', menuController.listMenuItems);

// Staff/admin only
router.post('/categories', authenticate, authorize('admin', 'staff'), menuController.createCategory);
router.patch('/categories/:id', authenticate, authorize('admin', 'staff'), menuController.updateCategory);
router.delete('/categories/:id', authenticate, authorize('admin'), menuController.deleteCategory);

router.post('/items', authenticate, authorize('admin', 'staff'), menuController.createMenuItem);
router.patch('/items/:id', authenticate, authorize('admin', 'staff'), menuController.updateMenuItem);
router.delete('/items/:id', authenticate, authorize('admin'), menuController.deleteMenuItem);

module.exports = router;
