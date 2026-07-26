const express = require("express");
const {
  listCategories, listMenuItems, createMenuItem, updateMenuItem,
} = require("../controllers/menuController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Public browsing — no auth required, matches the customer app's home/menu screens.
router.get("/branches/:branchId/categories", listCategories);
router.get("/branches/:branchId/menu-items", listMenuItems);

// Manager/Admin only — menu changes affect every customer immediately.
router.post("/menu-items", requireAuth, requireRole("manager", "admin"), createMenuItem);
router.patch("/menu-items/:id", requireAuth, requireRole("manager", "admin"), updateMenuItem);

module.exports = router;
