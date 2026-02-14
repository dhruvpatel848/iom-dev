const { ReportTemplate, User, Company, sequelize } = require("./models");
const fs = require("fs");
const path = require("path");

async function seedTemplates() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    // Get an admin user to assign as creator
    const admin = await User.findOne({ where: { role: "admin" } });
    if (!admin) {
      console.error("No admin user found. Create a user first.");
      process.exit(1);
    }

    const templatesDir = path.join(__dirname, "templates");
    if (!fs.existsSync(templatesDir)) {
      console.error("Templates directory not found.");
      process.exit(1);
    }

    const files = fs.readdirSync(templatesDir);

    for (const file of files) {
      // Determine company from filename (heuristic)
      // "FORMAT (REL) (RI).doc" -> Reliance?
      // "FORMAT CARE (RI).doc" -> Care Health?

      let companyName = "Other";
      if (file.toLowerCase().includes("rel")) companyName = "Reliance General";
      if (file.toLowerCase().includes("care")) companyName = "Care Health";

      // Check if company exists, if not create/use default
      let company = await Company.findOne({ where: { name: companyName } });
      if (!company) {
        // Try fuzzy match or default
        company = await Company.findOne(); // Assign to first available if not found
      }

      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file, ext);

      // Strictly only allow .docx files
      if (ext === ".docx") {
        // Check if template already exists to avoid duplicates
        const existingTemplate = await ReportTemplate.findOne({
          where: {
            template_name: `Imported: ${file}`,
          },
        });

        if (!existingTemplate) {
          await ReportTemplate.create({
            insurance_company: company ? company.name : "Unknown",
            template_name: `Imported: ${file}`,
            template_content: null, // File based
            file_path: path.join(templatesDir, file),
            created_by: admin.id,
          });
          console.log(`Imported ${file}`);
        } else {
          console.log(`Skipped ${file} (already imported)`);
        }
      } else if (ext === ".doc") {
        console.log(
          `Skipped ${file} (Legacy .doc format not supported. Please convert to .docx)`,
        );
      } else {
        console.log(`Skipped ${file} (unsupported format)`);
      }
    }

    console.log("Template import process completed.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding templates:", error);
    process.exit(1);
  }
}

seedTemplates();
