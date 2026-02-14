/**
 * Authentication middleware
 * Checks if user is logged in
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect("/auth/login");
}

/**
 * Role-based middleware
 * Checks if user has required role
 */
function hasRole(...roles) {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.redirect("/auth/login");
    }

    const { User } = require("../models");
    const user = await User.findByPk(req.session.userId);

    if (!user || !roles.includes(user.role)) {
      return res.status(403).render("error", {
        title: "Access Denied",
        message: "You do not have permission to access this resource.",
      });
    }

    req.user = user;
    next();
  };
}

/**
 * Admin-only middleware (allows admin and super_admin)
 */
async function isAdmin(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect("/auth/login");
    }

    const { User } = require("../models");
    const user = await User.findByPk(req.session.userId);

    if (!user || !["admin", "super_admin"].includes(user.role)) {
      return res.status(403).render("error", {
        title: "Access Denied",
        message: "You do not have permission to access this resource.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.redirect("/auth/login");
  }
}

/**
 * Super Admin-only middleware
 */
function isSuperAdmin(req, res, next) {
  return hasRole("super_admin")(req, res, next);
}

/**
 * Field Officer-only middleware
 */
function isFieldOfficer(req, res, next) {
  return hasRole("field_officer")(req, res, next);
}

/**
 * Attach user to request if logged in
 */
async function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const { User } = require("../models");
    req.user = await User.findByPk(req.session.userId);
  }
  next();
}

module.exports = {
  isAuthenticated,
  hasRole,
  isAdmin,
  isSuperAdmin,
  isFieldOfficer,
  attachUser,
};
