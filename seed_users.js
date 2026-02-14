const { sequelize, User } = require("./models");
const bcrypt = require("bcryptjs");

async function seedUsers() {
  try {
    await sequelize.authenticate();
    console.log("Connected to DB.");

    // Super Admin
    const superAdminEmail = "superadmin@investigation.com";
    const superAdmin = await User.findOne({
      where: { email: superAdminEmail },
    });

    if (!superAdmin) {
      await User.create({
        name: "Super Admin",
        email: superAdminEmail,
        password: "superpassword", // Will be hashed by hook
        role: "super_admin",
      });
      console.log("Super Admin user created.");
      console.log("Email:", superAdminEmail);
      console.log("Password: superpassword");
    } else {
      console.log("Super Admin already exists.");
    }

    // Field Officer
    const foEmail = "finance@investigation.com";
    const foUserExists = await User.findOne({ where: { email: foEmail } });

    if (!foUserExists) {
      await User.create({
        name: "Field Officer",
        email: foEmail,
        password: "financepassword", // Will be hashed by hook
        role: "field_officer",
      });
      console.log("Field Officer user created.");
      console.log("Email:", foEmail);
      console.log("Password: financepassword");
    } else {
      console.log("Field Officer already exists.");
    }

    process.exit(0);
  } catch (e) {
    console.error("Error seeding users:", e);
    process.exit(1);
  }
}

seedUsers();
