const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'staff'), reservationController.listReservations);
router.post('/', authenticate, reservationController.createReservation);
router.patch('/:id/status', authenticate, authorize('admin', 'staff'), reservationController.updateReservationStatus);

module.exports = router;
