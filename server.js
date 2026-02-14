const express = require("express");
const path = require("path");
const compression = require("compression");
const expressLayouts = require("express-ejs-layouts");
const sessionConfig = require("./config/session");
const { sequelize } = require("./models");
const { attachUser } = require("./middleware/auth");
const { checkLicense } = require("./middleware/license");
require("dotenv").config();
require("pg");
require("pg-hstore");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable gzip compression for all responses
app.use(compression());

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// Middleware
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Static files with caching (1 day for production)
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  }),
);

app.set("trust proxy", 1);
app.use(sessionConfig);
app.use(attachUser);
app.use(checkLicense); // Add license check here

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success = req.session.success || null;
  res.locals.error = req.session.error || null;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Routes
const setupRoutes = require("./routes/setup");
const authRoutes = require("./routes/auth");
const caseRoutes = require("./routes/cases");
const documentRoutes = require("./routes/documents");
const reportRoutes = require("./routes/reports");
const adminRoutes = require("./routes/admin");
const companyRoutes = require("./routes/companies");
const billingRoutes = require("./routes/billing");

app.use("/setup", setupRoutes);
app.use("/auth", authRoutes);
app.use("/cases", caseRoutes);
app.use("/documents", documentRoutes);
app.use("/reports", reportRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/companies", companyRoutes);
app.use("/billing", billingRoutes);

// Home route
app.get("/", (req, res) => {
  if (req.user) {
    if (req.user.role === "admin" || req.user.role === "super_admin") {
      return res.redirect("/admin/dashboard");
    } else {
      return res.redirect("/cases/dashboard");
    }
  }
  res.redirect("/auth/login");
});

// Error handling
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page Not Found",
    message: "The page you are looking for does not exist.",
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    title: "Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong.",
  });
});

// Database sync and server start
// Database sync and server start
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Sync database (creates tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("Database synchronized.");

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    if (require.main === module) process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
