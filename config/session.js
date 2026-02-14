const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { sequelize } = require("../models");
require("dotenv").config();

const sessionStore = new SequelizeStore({
  db: sequelize,
  checkExpirationInterval: 15 * 60 * 1000, // The interval at which to cleanup expired sessions in milliseconds.
  expiration: 1000 * 60 * 60 * 24 * 365 * 100, // The maximum age (in milliseconds) of a valid session.
});

module.exports = session({
  secret: process.env.SESSION_SECRET || "your-secret-key",
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 365 * 100, // 100 years
  },
});

// Create the session table if it doesn't exist
sessionStore.sync();
