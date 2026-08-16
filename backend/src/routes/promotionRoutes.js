const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', promotionController.listPromotions);
router.post('/', authenticate, authorize('admin'), promotionController.createPromotion);
router.patch('/:id', authenticate, authorize('admin'), promotionController.updatePromotion);
router.delete('/:id', authenticate, authorize('admin'), promotionController.deletePromotion);

module.exports = router;
