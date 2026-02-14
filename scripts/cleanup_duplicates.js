const {
  sequelize,
  Commission,
  PatientDetail,
  HospitalDetail,
  PolicyDetail,
  BillDetail,
  InvestigationNote,
} = require("../models");

async function cleanupDuplicates(Model, modelName) {
  try {
    console.log(`Checking ${modelName} for duplicates...`);
    const records = await Model.findAll({
      order: [
        ["case_id", "ASC"],
        ["updatedAt", "DESC"],
      ],
    });

    const seenCaseIds = new Set();
    let duplicatesCount = 0;

    for (const record of records) {
      if (seenCaseIds.has(record.case_id)) {
        // Duplicate found (since we ordered by DESC, this is an older one)
        await record.destroy();
        duplicatesCount++;
      } else {
        seenCaseIds.add(record.case_id);
      }
    }

    console.log(
      `✅ Removed ${duplicatesCount} duplicate records from ${modelName}`,
    );
  } catch (error) {
    console.error(`❌ Error cleaning ${modelName}:`, error);
  }
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Database connected. Starting cleanup...");

    await cleanupDuplicates(Commission, "Commission");
    await cleanupDuplicates(PatientDetail, "PatientDetail");
    await cleanupDuplicates(HospitalDetail, "HospitalDetail");
    await cleanupDuplicates(PolicyDetail, "PolicyDetail");
    await cleanupDuplicates(BillDetail, "BillDetail");
    await cleanupDuplicates(InvestigationNote, "InvestigationNote");

    console.log("\n✨ Cleanup complete! Duplicate entries resolved.");
  } catch (error) {
    console.error("Fatal Error:", error);
  } finally {
    await sequelize.close();
  }
}

run();
