const express = require("express");
const { initiateCharge, refundPayment } = require("../controllers/paymentController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/payments/orange-money", requireAuth, initiateCharge("orange_money"));
router.post("/payments/momo", requireAuth, initiateCharge("momo"));
router.post("/payments/card", requireAuth, initiateCharge("card"));
router.post("/payments/cash", requireAuth, initiateCharge("cash"));

router.post("/payments/:id/refund", requireAuth, requireRole("manager", "admin", "cashier"), refundPayment);

module.exports = router;
