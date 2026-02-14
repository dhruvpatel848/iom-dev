const { v4: uuidv4 } = require("uuid");
const { License, sequelize } = require("../models");

function generateKey() {
  // Format: XXXX-XXXX-XXXX-XXXX
  const raw = uuidv4().replace(/-/g, "").toUpperCase();
  return `${raw.substring(0, 4)}-${raw.substring(4, 8)}-${raw.substring(8, 12)}-${raw.substring(12, 16)}`;
}

async function createLicense(clientName = "Standard User") {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // Ensure table exists

    const key = generateKey();

    const license = await License.create({
      key: key,
      client_name: clientName,
      is_active: false,
    });

    console.log("\n✅ New License Generated successfully!");
    console.log("----------------------------------------");
    console.log(`🔑 Key:         ${license.key}`);
    console.log(`👤 Client:      ${license.client_name}`);
    console.log(`📅 Created:     ${new Date().toLocaleString()}`);
    console.log("----------------------------------------\n");
  } catch (error) {
    console.error("❌ Error generating license:", error.message);
  } finally {
    await sequelize.close();
  }
}

// Allow running with a client name argument
const clientName = process.argv[2] || "Standard User";
createLicense(clientName);
