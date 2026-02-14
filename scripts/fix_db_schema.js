const { sequelize } = require('../models');

async function checkAndFixSchema() {
    try {
        // Check if column exists
        const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cases' AND column_name = 'field_officer_id';
    `);

        if (results.length === 0) {
            console.log('Column field_officer_id missing. Adding it now...');
            await sequelize.query(`
        ALTER TABLE "cases" 
        ADD COLUMN "field_officer_id" INTEGER DEFAULT NULL;
      `);

            // Separate constraint addition to handle potential errors gracefully or if constraint names conflict
            try {
                await sequelize.query(`
          ALTER TABLE "cases"
          ADD CONSTRAINT "fk_cases_field_officer_id"
          FOREIGN KEY ("field_officer_id") REFERENCES "users" ("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        `);
                console.log('Foreign key constraint added.');
            } catch (e) {
                console.log('Constraint might already exist or failed:', e.message);
            }

            console.log('Column field_officer_id added successfully.');
        } else {
            console.log('Column field_officer_id already exists.');
        }

        // Verify
        const [verify] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cases' AND column_name = 'field_officer_id';
    `);
        console.log('Verification:', verify);

    } catch (error) {
        console.error('Error during schema check/fix:', error);
    } finally {
        await sequelize.close();
    }
}

checkAndFixSchema();
