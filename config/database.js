const { Sequelize } = require("sequelize");
require("dotenv").config();

// Determine SSL configuration based on port
// Port 6543 = Supabase connection pooler (requires simpler SSL)
// Port 5432 = Direct connection (requires detailed SSL options)
const isPoolerMode = Number(process.env.DB_PORT || 5432) === 6543;

const sslConfig = isPoolerMode
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
  : {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    };

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    dialect: "postgres",
    logging: false,
    dialectOptions: sslConfig,
    pool: {
      max: 10,
      min: 0,
      acquire: 20000,
      idle: 10000,
    },
  },
);

module.exports = sequelize;
