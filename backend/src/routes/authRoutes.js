const express = require("express");
const { syncUser, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Called by the mobile/web client immediately after Firebase sign-in succeeds.
router.post("/sync", syncUser);

// Returns the currently authenticated user's profile.
router.get("/me", requireAuth, me);

module.exports = router;
