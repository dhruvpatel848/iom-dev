const { Company, sequelize } = require('./models');

const companies = [
    "ICICI Lombard",
    "HDFC ERGO",
    "Bajaj Allianz",
    "Star Health",
    "Care Health",
    "Max Bupa",
    "Reliance General",
    "National Insurance",
    "Oriental Insurance",
    "United India Insurance",
    "New India Assurance"
];

async function seedCompanies() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');
        await sequelize.sync();

        for (const name of companies) {
            await Company.findOrCreate({
                where: { name },
                defaults: { name, active: true }
            });
        }
        console.log('Companies seeded successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding companies:', error);
        process.exit(1);
    }
}

seedCompanies();
