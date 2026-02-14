const { sequelize, User } = require('./models');

async function reset() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        // Force sync to drop and recreate tables
        // Note: cascading might require force on specific models or simple global force
        await sequelize.sync({ force: true });
        console.log('Database cleared (tables dropped and recreated).');

        // Create Admin
        await User.create({
            name: 'Admin',
            email: 'admin@investigation.com',
            password: 'admin', // Will be hashed by hook
            role: 'admin'
        });

        console.log('Admin user created.');
        console.log('Email: admin@investigation.com');
        console.log('Password: admin');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

reset();
