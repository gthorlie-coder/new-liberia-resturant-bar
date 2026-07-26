const express = require("express");
const {
  createOrder, getOrder, listUserOrders, updateOrderStatus,
} = require("../controllers/orderController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/orders", requireAuth, createOrder);
router.get("/orders/:id", requireAuth, getOrder);
router.get("/users/:userId/orders", requireAuth, listUserOrders);

router.patch(
  "/orders/:id/status",
  requireAuth,
  requireRole("staff", "kitchen", "bartender", "cashier", "rider", "manager", "admin"),
  updateOrderStatus
);

module.exports = router;
