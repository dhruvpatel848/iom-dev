const express = require("express");
const router = express.Router();
const { User } = require("../models");
const { logActivity } = require("../helpers/auditLogger");

// Login page
router.get("/login", (req, res) => {
  if (req.user) {
    if (["admin", "super_admin"].includes(req.user.role)) {
      return res.redirect("/admin/dashboard");
    } else {
      return res.redirect("/cases/dashboard");
    }
  }
  res.render("auth/login", {
    title: "Login",
    layout: "layouts/auth",
  });
});

// Login handler
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      req.session.error = "Please provide email and password.";
      return res.redirect("/auth/login");
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      req.session.error = "Invalid email or password.";
      return res.redirect("/auth/login");
    }

    // Check password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      req.session.error = "Invalid email or password.";
      return res.redirect("/auth/login");
    }

    // Set session
    req.session.userId = user.id;
    req.session.success = `Welcome back, ${user.name}!`;
    logActivity(req, "LOGIN", "User", user.id, `User ${user.email} logged in.`);

    if (["admin", "super_admin"].includes(user.role)) {
      res.redirect("/admin/dashboard");
    } else {
      res.redirect("/cases/dashboard");
    }
  } catch (error) {
    console.error("Login error:", error);
    req.session.error = "An error occurred during login.";
    res.redirect("/auth/login");
  }
});

// Logout handler
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.redirect("/auth/login");
  });
});

module.exports = router;
