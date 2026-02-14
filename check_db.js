const { sequelize } = require("./models");

async function checkConnection() {
  try {
    console.log("Testing database connection...");
    console.log(`Host: ${process.env.DB_HOST}`);
    await sequelize.authenticate();
    console.log("✅ Connection established successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error.message);
    process.exit(1);
  }
}

checkConnection();
