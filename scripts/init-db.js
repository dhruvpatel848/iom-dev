const { sequelize, User, ReportTemplate } = require("../models");
require("dotenv").config();

async function initializeDatabase() {
  try {
    console.log("🔄 Connecting to database...");
    await sequelize.authenticate();
    console.log("✅ Database connection established successfully.");

    console.log("\n🔄 Syncing database schema...");
    await sequelize.sync({ force: false, alter: true });
    console.log("✅ Database schema synchronized.");

    // Create default admin user
    console.log("\n🔄 Checking for default admin user...");
    const adminExists = await User.findOne({
      where: { email: "admin@investigation.com" },
    });

    if (!adminExists) {
      await User.create({
        name: "System Administrator",
        email: "admin@investigation.com",
        password: "admin123",
        role: "admin",
      });
      console.log("✅ Default admin user created:");
      console.log("   Email: admin@investigation.com");
      console.log("   Password: admin123");
      console.log("   ⚠️  IMPORTANT: Change this password after first login!");
    } else {
      console.log("ℹ️  Admin user already exists.");
    }

    // Create sample template
    console.log("\n🔄 Checking for sample templates...");
    const templateExists = await ReportTemplate.findOne({
      where: { insurance_company: "ICICI Lombard" },
    });

    if (!templateExists) {
      const admin = await User.findOne({ where: { role: "admin" } });

      await ReportTemplate.create({
        insurance_company: "ICICI Lombard",
        template_name: "Standard Investigation Report",
        created_by: admin.id,
        template_content: `MEDICAL CLAIM INVESTIGATION REPORT

Case ID: {{case_id}}
Insurance Company: {{insurance_company}}
Date: {{generated_date}}

---

PATIENT DETAILS

Name: {{patient_name}}
Age: {{patient_age}} years
Gender: {{patient_gender}}
Address: {{patient_address}}
Aadhaar/ID: {{patient_aadhaar}}

Admission Date: {{admission_date}}
Discharge Date: {{discharge_date}}

---

HOSPITAL DETAILS

Hospital Name: {{hospital_name}}
Address: {{hospital_address}}
Registration Number: {{hospital_registration}}
Treating Doctor: {{doctor_name}}

---

POLICY DETAILS

Policy Number: {{policy_number}}
Policy Type: {{policy_type}}
Sum Insured: ₹{{sum_insured}}
Claim Type: {{claim_type}}
Claim Amount: ₹{{claim_amount}}

---

INVESTIGATION FINDINGS

{{investigation_findings}}

---

OBSERVATIONS

{{observations}}

---

RED FLAGS (IF ANY)

{{red_flags}}

---

SUPPORTING NOTES

{{supporting_notes}}

---

CONCLUSION

{{conclusion}}

---

RECOMMENDATION

{{recommendation}}

---

Investigated By: {{officer_name}}
Report Generated On: {{generated_date}}

---

This is a computer-generated report for ICICI Lombard General Insurance Company Limited.`,
      });
      console.log("✅ Sample template created for ICICI Lombard.");
    } else {
      console.log("ℹ️  Sample templates already exist.");
    }

    console.log("\n✅ Database initialization complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update .env file with your MySQL credentials");
    console.log("   2. Run: npm start");
    console.log("   3. Login with admin@investigation.com / admin123");
    console.log("   4. Create additional users and templates as needed\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
}

initializeDatabase();
