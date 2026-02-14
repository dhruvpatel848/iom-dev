const { sequelize } = require("./models");

async function checkSessionTable() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const [results] = await sequelize.query(
      "SELECT * FROM information_schema.tables WHERE table_name = 'Sessions'",
    );

    if (results.length > 0) {
      console.log("SUCCESS: 'Sessions' table exists.");
    } else {
      console.log(
        "FAILURE: 'Sessions' table does not exist yet. Run the server to create it.",
      );
    }
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    await sequelize.close();
  }
}

checkSessionTable();
