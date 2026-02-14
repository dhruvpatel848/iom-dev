const { sequelize, User } = require('./models');

async function checkUsers() {
    try {
        await sequelize.authenticate();
        const users = await User.findAll();
        console.log('--- USERS ---');
        users.forEach(u => console.log(`${u.email} - Role: ${u.role}`));
        console.log('--- END USERS ---');
    } catch (e) {
        console.error(e);
    }
}

checkUsers();
