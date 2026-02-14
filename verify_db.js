const { Sequelize } = require("sequelize");
require("dotenv").config();

console.log("Testing database connection...");

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not defined in .env");
  process.exit(1);
}

// Mask password for logging
const safeUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@");
console.log(`URL: ${safeUrl}`);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

async function verifyConnection() {
  try {
    await sequelize.authenticate();
    console.log("✅ Connection established successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error.message);
    process.exit(1);
  }
}

verifyConnection();
