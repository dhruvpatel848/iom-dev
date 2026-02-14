const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { isAdmin, isSuperAdmin } = require("../middleware/auth");
const {
  User,
  ReportTemplate,
  Case,
  Commission,
  Company,
  AuditLog,
  sequelize,
  PolicyDetail,
} = require("../models");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const GoogleDriveStorage = require("../config/googleDrive");
const { logActivity } = require("../helpers/auditLogger");

// Configure multer for templates - using memory storage for cloud upload
const templateStorage = multer.memoryStorage();

const uploadTemplate = multer({
  storage: templateStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024,
  }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .docx files are allowed"));
    }
  },
});

// Google Drive OAuth Authorization
router.get("/google-auth", isAdmin, (req, res) => {
  const isAuthorized = GoogleDriveStorage.isAuthorized();
  const authUrl = GoogleDriveStorage.getAuthUrl();

  res.render("admin/google-auth", {
    title: "Google Drive Authorization",
    isAuthorized,
    authUrl,
    error: req.session.error,
    success: req.session.success,
  });
  delete req.session.error;
  delete req.session.success;
});

router.get("/google-auth/callback", isAdmin, async (req, res) => {
  const { code } = req.query;

  if (!code) {
    req.session.error = "No authorization code received";
    return res.redirect("/admin/google-auth");
  }

  const success = await GoogleDriveStorage.setAuthCode(code);

  if (success) {
    req.session.success =
      "Google Drive authorized successfully! You can now upload files.";
  } else {
    req.session.error = "Failed to authorize Google Drive";
  }

  res.redirect("/admin/google-auth");
});

// Dashboard
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    // 1. Overall Case Stats
    const caseStatsData = await Case.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    const recentCases = await Case.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "officer", attributes: ["name"] }],
    });

    const overallStats = {
      open: 0,
      in_progress: 0,
      closed: 0,
      total: 0,
    };

    caseStatsData.forEach((stat) => {
      const val = parseInt(stat.get("count"));
      overallStats[stat.status] = val;
      overallStats.total += val;
    });

    // 2. User Performance
    const officers = await User.findAll({ where: { role: "officer" } });

    // Group cases by officer and status
    const officerCaseStats = await Case.findAll({
      attributes: [
        "officer_id",
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["officer_id", "status"],
    });

    const officerStats = officers.map((officer) => {
      const stats = {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        open: 0,
        in_progress: 0,
        closed: 0,
        total: 0,
      };

      // Find relevant stats
      const userStats = officerCaseStats.filter(
        (s) => s.officer_id === officer.id,
      );
      userStats.forEach((s) => {
        const count = parseInt(s.get("count"));
        stats[s.status] = count;
        stats.total += count;
      });

      return stats;
    });

    // 3. Commission Stats (Only for Super Admin)
    let commissionStats = null;
    if (req.user.role === "super_admin") {
      const commissionStatsData = await Commission.findAll({
        attributes: [
          "status",
          [sequelize.fn("SUM", sequelize.col("amount")), "total"],
        ],
        group: ["status"],
      });

      commissionStats = {
        paid: 0,
        pending: 0,
        total_amount: 0,
      };

      commissionStatsData.forEach((s) => {
        const val = parseFloat(s.get("total")) || 0;
        commissionStats[s.status] = val;
        commissionStats.total_amount += val;
      });
    }

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      overallStats,
      officerStats,
      commissionStats,
      recentCases,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    req.session.error = "Error loading dashboard";
    res.redirect("/");
  }
});

// User management routes

// List users
router.get("/users", isAdmin, async (req, res) => {
  console.log("USERS LIST ROUTE HIT:", req.method, req.originalUrl);
  try {
    const whereClause = {};
    if (req.user.role !== "super_admin") {
      whereClause.role = { [Op.notIn]: ["super_admin", "field_officer"] };
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: ["id", "name", "email", "role", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    res.render("admin/users/index", {
      title: "User Management",
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    req.session.error = "Error loading users: " + error.message;
    res.redirect("/");
  }
});

// Create user form
router.get("/users/create", isAdmin, (req, res) => {
  console.log("USERS CREATE ROUTE HIT:", req.method, req.originalUrl);
  res.render("admin/users/create", {
    title: "Create User",
  });
});

// Create user
router.post(
  "/users",
  isAdmin,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .isIn(["officer", "admin", "super_admin", "field_officer"])
      .withMessage("Invalid role"),
  ],
  async (req, res) => {
    console.log("USERS CREATE ROUTE HIT:", req.method, req.originalUrl);
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.session.error = errors.array()[0].msg;
        return res.redirect("/admin/users/create");
      }

      let { name, email, password, role } = req.body;

      // Access Control: Non-super_admins can only create officers
      if (req.user.role !== "super_admin") {
        role = "officer";
      }

      // Check if email already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        req.session.error = "Email already exists";
        return res.redirect("/admin/users/create");
      }

      const newUser = await User.create({ name, email, password, role });

      logActivity(
        req,
        "CREATE_USER",
        "User",
        newUser.id,
        `Created user ${email} (${role})`,
      );

      req.session.success = "User created successfully";
      res.redirect("/admin/users");
    } catch (error) {
      console.error("Error creating user:", error);
      req.session.error = "Error creating user: " + error.message;
      res.redirect("/admin/users/create");
    }
  },
);

// Edit user form
router.get("/users/:id/edit", isAdmin, async (req, res) => {
  console.log("USERS EDIT ROUTE HIT:", req.method, req.originalUrl);
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      req.session.error = "User not found";
      return res.redirect("/admin/users");
    }

    // Access Control: Admin cannot edit Super Admin
    if (req.user.role !== "super_admin" && user.role === "super_admin") {
      req.session.error = "Access denied: Cannot edit Super Admin";
      return res.redirect("/admin/users");
    }

    res.render("admin/users/edit", {
      title: "Edit User",
      editUser: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    req.session.error = "Error loading user";
    res.redirect("/admin/users");
  }
});

// Update user
router.post("/users/:id", isAdmin, async (req, res) => {
  console.log("USERS UPDATE ROUTE HIT:", req.method, req.originalUrl);
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      req.session.error = "User not found";
      return res.redirect("/admin/users");
    }

    const { name, email, role, password } = req.body;

    user.name = name;
    user.email = email;

    // Access Control:
    if (req.user.role === "super_admin") {
      user.role = role;
    } else {
      // Non-super_admin logic
      if (user.id === req.user.id) {
        // Self-edit: Keep existing role (cannot change own role)
        // user.role = user.role; // No-op
      } else {
        // Editing others: Force role to officer
        user.role = "officer";
      }
    }

    if (password && password.trim() !== "") {
      user.password = password;
    }

    await user.save();

    logActivity(
      req,
      "UPDATE_USER",
      "User",
      user.id,
      `Updated user ${user.email} role to ${role}`,
    );

    req.session.success = "User updated successfully";
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error updating user:", error);
    req.session.error = "Error updating user: " + error.message;
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

// Delete user
router.post("/users/:id/delete", isAdmin, async (req, res) => {
  console.log("USERS DELETE ROUTE HIT:", req.method, req.originalUrl);
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Access Control: Admin cannot delete Super Admin
    if (req.user.role !== "super_admin" && user.role === "super_admin") {
      return res.json({
        success: false,
        message: "Access denied: Cannot delete Super Admin",
      });
    }

    // Don't allow deleting self
    if (user.id === req.user.id) {
      return res.json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Check if user has cases
    const caseCount = await Case.count({ where: { officer_id: user.id } });
    if (caseCount > 0) {
      return res.json({
        success: false,
        message: `Cannot delete user with ${caseCount} assigned cases`,
      });
    }

    await user.destroy();

    logActivity(
      req,
      "DELETE_USER",
      "User",
      req.params.id,
      `Deleted user ${user.email}`,
    );

    req.session.success = "User deleted successfully";
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.json({
      success: false,
      message: "Error deleting user: " + error.message,
    });
  }
});

// Template management routes

// List templates
router.get("/templates", isAdmin, async (req, res) => {
  console.log("TEMPLATES ROUTE HIT:", req.method, req.originalUrl);
  try {
    const companies = await Company.findAll({
      where: { active: true },
      order: [["name", "ASC"]],
    });

    const templates = await ReportTemplate.findAll({
      include: [{ model: User, as: "creator", attributes: ["name"] }],
      order: [["createdAt", "DESC"]],
    });

    res.render("admin/templates/index", {
      title: "Report Templates",
      templates,
      companies,
      error: req.session.error,
      success: req.session.success,
    });
    req.session.error = null;
    req.session.success = null;
  } catch (error) {
    console.error("Error fetching templates:", error);
    req.session.error = "Error loading templates";
    res.redirect("/");
  }
});

// Create template form
router.get("/templates/create", isAdmin, async (req, res) => {
  console.log("TEMPLATES CREATE ROUTE HIT:", req.method, req.originalUrl);
  try {
    const companies = await Company.findAll({
      where: { active: true },
      order: [["name", "ASC"]],
    });

    res.render("admin/templates/create", {
      title: "Create Report Template",
      companies,
    });
  } catch (error) {
    console.error("Error loading template create form:", error);
    req.session.error = "Error loading form";
    res.redirect("/admin/templates");
  }
});

// Create template
router.post("/templates", isAdmin, async (req, res) => {
  console.log("TEMPLATES CREATE ROUTE HIT:", req.method, req.originalUrl);
  try {
    let { insurance_company, template_name, template_content } = req.body;

    if (insurance_company === "Other") {
      const { other_company } = req.body;
      if (!other_company || other_company.trim() === "") {
        req.session.error = "Please specify the company name";
        return res.redirect("/admin/templates/create");
      }
      insurance_company = other_company.trim();
    }

    if (!insurance_company || !template_name || !template_content) {
      req.session.error = "All fields are required";
      return res.redirect("/admin/templates/create");
    }

    // Since this is the manual create route, there is no file upload here
    // But we might be creating a text-based template or placeholder

    await ReportTemplate.create({
      insurance_company,
      template_name: template_name,
      template_content: template_content,
      created_by: req.user.id,
    });

    req.session.success = "Template created successfully";
    res.redirect("/admin/templates");
  } catch (error) {
    console.error("Error creating template:", error);
    req.session.error = "Error creating template: " + error.message;
    res.redirect("/admin/templates/create");
  }
});

// Edit template form
router.get("/templates/:id/edit", isAdmin, async (req, res) => {
  console.log("TEMPLATES EDIT ROUTE HIT:", req.method, req.originalUrl);
  try {
    console.log(`Debug: Attempting to edit template with ID: ${req.params.id}`);
    const template = await ReportTemplate.findByPk(req.params.id);
    if (!template) {
      console.log(`Debug: Template not found for ID: ${req.params.id}`);
      req.session.error = "Template not found";
      return res.redirect("/admin/templates");
    }

    res.render("admin/templates/edit", {
      title: "Edit Template",
      template,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    req.session.error = "Error loading template";
    res.redirect("/admin/templates");
  }
});

// Upload template
router.post(
  "/templates/upload",
  isAdmin,
  (req, res, next) => {
    console.log("UPLOAD USER:", req.user);
    console.log("TEMPLATES UPLOAD ROUTE HIT:", req.method, req.originalUrl);
    uploadTemplate.single("template_file")(req, res, function (err) {
      if (err) {
        req.session.error = err.message;
        return res.redirect("/admin/templates");
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        req.session.error = "Please upload a .docx file";
        return res.redirect("/admin/templates");
      }

      let { insurance_company, template_name } = req.body;

      if (insurance_company === "Other") {
        const { other_company } = req.body;
        if (!other_company || other_company.trim() === "") {
          req.session.error = "Please specify the company name";
          return res.redirect("/admin/templates");
        }
        insurance_company = other_company.trim();
      }

      if (!insurance_company || !template_name) {
        req.session.error = "All fields are required";
        return res.redirect("/admin/templates");
      }

      // Save to local storage (syncs to Google Drive if configured)
      const fileName = `templates/${GoogleDriveStorage.generateFileName(
        "template",
        req.file.originalname,
      )}`;
      // Upload to 'Templates' subfolder in Google Drive
      const result = await GoogleDriveStorage.uploadBuffer(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        ["Templates"],
      );

      await ReportTemplate.create({
        insurance_company,
        template_name: `Imported: ${template_name}`,
        template_content: null,
        file_path: result.filePath,
        created_by: req.user.id,
      });

      req.session.success = "Template uploaded successfully";
      res.redirect("/admin/templates");
    } catch (error) {
      console.error("Error uploading template:", error);
      req.session.error = "Error uploading template: " + error.message;
      res.redirect("/admin/templates");
    }
  },
);

// Update template
router.post("/templates/:id", isAdmin, async (req, res) => {
  console.log("TEMPLATES UPDATE ROUTE HIT:", req.method, req.originalUrl);
  try {
    const template = await ReportTemplate.findByPk(req.params.id);
    if (!template) {
      req.session.error = "Template not found";
      return res.redirect("/admin/templates");
    }

    const { insurance_company, template_name, template_content } = req.body;

    template.insurance_company = insurance_company;
    template.template_name = template_name;
    template.template_content = template_content;

    await template.save();

    req.session.success = "Template updated successfully";
    res.redirect("/admin/templates");
  } catch (error) {
    console.error("Error updating template:", error);
    req.session.error = "Error updating template: " + error.message;
    res.redirect(`/admin/templates/${req.params.id}/edit`);
  }
});

// Delete template
router.post("/templates/:id/delete", isAdmin, async (req, res) => {
  console.log("TEMPLATES DELETE ROUTE HIT:", req.method, req.originalUrl);
  try {
    const template = await ReportTemplate.findByPk(req.params.id);
    if (!template) {
      return res.json({ success: false, message: "Template not found" });
    }

    // If file based, delete the file too
    if (template.file_path) {
      // Delete local file
      if (
        !template.file_path.startsWith("http") &&
        fs.existsSync(template.file_path)
      ) {
        try {
          fs.unlinkSync(template.file_path);
          console.log("Deleted local template file:", template.file_path);
        } catch (e) {
          console.error("Error deleting local file:", e);
        }
      }
    }

    await template.destroy();
    req.session.success = "Template deleted successfully";
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.json({
      success: false,
      message: "Error deleting template: " + error.message,
    });
  }
});

// Company management routes

// List companies
router.get("/companies", isAdmin, async (req, res) => {
  console.log("COMPANIES LIST ROUTE HIT:", req.method, req.originalUrl);
  try {
    const companies = await Company.findAll({
      order: [["name", "ASC"]],
    });

    res.render("admin/companies/index", {
      title: "Company Management",
      companies,
      error: req.session.error,
      success: req.session.success,
    });
    req.session.error = null;
    req.session.success = null;
  } catch (error) {
    console.error("Error fetching companies:", error);
    req.session.error = "Error loading companies";
    res.redirect("/admin/dashboard");
  }
});

// Create company
router.post("/companies", isAdmin, async (req, res) => {
  console.log("COMPANIES create ROUTE HIT:", req.method, req.originalUrl);
  try {
    const { name, active } = req.body;

    if (!name || name.trim() === "") {
      req.session.error = "Company name is required";
      return res.redirect("/admin/companies");
    }

    // Check if exists
    const existing = await Company.findOne({ where: { name: name.trim() } });
    if (existing) {
      req.session.error = "Company already exists";
      return res.redirect("/admin/companies");
    }

    const newCompany = await Company.create({
      name: name.trim(),
      active: active === "on" ? true : false,
    });

    logActivity(
      req,
      "CREATE_COMPANY",
      "Company",
      newCompany.id,
      `Created company ${name}`,
    );

    req.session.success = "Company created successfully";
    res.redirect("/admin/companies");
  } catch (error) {
    console.error("Error creating company:", error);
    req.session.error = "Error creating company: " + error.message;
    res.redirect("/admin/companies");
  }
});

// Update company
router.post("/companies/:id", isAdmin, async (req, res) => {
  console.log("COMPANIES UPDATE ROUTE HIT:", req.method, req.originalUrl);
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) {
      req.session.error = "Company not found";
      return res.redirect("/admin/companies");
    }

    const { name, active } = req.body;

    if (name && name.trim() !== "") {
      company.name = name.trim();
    }

    // Checkbox sends 'on' if checked, nothing if unchecked
    company.active = active === "on";

    await company.save();

    logActivity(
      req,
      "UPDATE_COMPANY",
      "Company",
      company.id,
      `Updated company ${name}`,
    );

    req.session.success = "Company updated successfully";
    res.redirect("/admin/companies");
  } catch (error) {
    console.error("Error updating company:", error);
    req.session.error = "Error updating company: " + error.message;
    res.redirect("/admin/companies");
  }
});

// Delete company
router.post("/companies/:id/delete", isAdmin, async (req, res) => {
  console.log("COMPANIES DELETE ROUTE HIT:", req.method, req.originalUrl);
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) {
      return res.json({ success: false, message: "Company not found" });
    }

    await company.destroy();

    logActivity(
      req,
      "DELETE_COMPANY",
      "Company",
      req.params.id,
      `Deleted company ${company.name}`,
    );

    req.session.success = "Company deleted successfully";
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.json({
      success: false,
      message: "Error deleting company: " + error.message,
    });
  }
});

// Analysis Dashboard
router.get("/analysis", isSuperAdmin, async (req, res) => {
  try {
    const { startDate, endDate, month, year } = req.query;
    const whereClause = {};
    const caseWhere = {};

    // Date Filtering Logic
    let start, end;
    const currentYear = new Date().getFullYear();

    // Priority: Date Range > Month+Year > Month Only > Year Only
    if (startDate && endDate) {
      // Date range filter takes priority
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else if (month && year) {
      // Both month and year specified
      start = new Date(parseInt(year), parseInt(month) - 1, 1);
      end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
    } else if (month) {
      // Only month specified - use current year
      start = new Date(currentYear, parseInt(month) - 1, 1);
      end = new Date(currentYear, parseInt(month), 0, 23, 59, 59, 999);
    } else if (year) {
      // Only year specified
      start = new Date(parseInt(year), 0, 1);
      end = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
    }

    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      whereClause.createdAt = {
        [Op.between]: [start, end],
      };
      caseWhere.createdAt = {
        [Op.between]: [start, end],
      };
    }

    // 1. Commission Stats by Company & Status
    // We fetch all commissions matching the filter
    const commissions = await Commission.findAll({
      where: whereClause,
      include: [
        {
          model: Case,
          as: "case",
          include: [
            {
              model: PolicyDetail,
              as: "policyDetail",
              attributes: ["insurance_company"],
            },
          ],
        },
      ],
    });

    // Aggregation Logic
    const companyStats = {};
    let totalCommission = 0;
    let pendingCommission = 0;
    let paidCommission = 0;

    commissions.forEach((comm) => {
      const company =
        comm.case?.insurance_company ||
        comm.case?.policyDetail?.insurance_company ||
        "Unknown";
      const amount = parseFloat(comm.amount) || 0;

      if (!companyStats[company]) {
        companyStats[company] = { commission: 0, claims: 0 };
      }

      companyStats[company].commission += amount;
      totalCommission += amount;

      if (comm.status === "pending") {
        pendingCommission += amount;
      } else {
        paidCommission += amount;
      }
    });

    // 2. Claim Stats by Company
    const cases = await Case.findAll({
      where: caseWhere,
      include: [
        {
          model: PolicyDetail,
          as: "policyDetail",
          attributes: ["insurance_company", "claim_amount"],
        },
      ],
    });

    let totalClaims = 0;
    cases.forEach((c) => {
      const company =
        c.insurance_company || c.policyDetail?.insurance_company || "Unknown";
      const amount = parseFloat(c.policyDetail?.claim_amount) || 0;

      if (!companyStats[company]) {
        companyStats[company] = { commission: 0, claims: 0 };
      }
      companyStats[company].claims += amount;
      totalClaims += amount;
    });

    // Prepare Chart Data
    const labels = Object.keys(companyStats).sort();
    const commissionData = labels.map((l) => companyStats[l].commission);
    const claimData = labels.map((l) => companyStats[l].claims);

    res.render("admin/analysis", {
      title: "Analysis Dashboard",
      totalCommission,
      pendingCommission,
      paidCommission,
      totalClaims,
      labels: JSON.stringify(labels),
      commissionData: JSON.stringify(commissionData),
      claimData: JSON.stringify(claimData),
      query: req.query,
    });
  } catch (error) {
    console.error("Error loading analysis:", error);
    req.session.error = "Error loading analysis";
    res.redirect("/admin/dashboard");
  }
});

// Activity Logs route (Super Admin only)
router.get("/logs", isSuperAdmin, async (req, res) => {
  try {
    const limit = 50;

    // Get total count of logs
    const totalCount = await AuditLog.count();

    // If there are more than 50 records, delete the older ones
    if (totalCount > limit) {
      // Get the ID of the 50th most recent log
      const cutoffLog = await AuditLog.findOne({
        attributes: ["id", "createdAt"],
        order: [["createdAt", "DESC"]],
        offset: limit - 1,
        limit: 1,
      });

      if (cutoffLog) {
        // Delete all logs older than the 50th most recent
        await AuditLog.destroy({
          where: {
            createdAt: {
              [Op.lt]: cutoffLog.createdAt,
            },
          },
        });
      }
    }

    // Fetch the last 50 logs
    const logs = await AuditLog.findAll({
      limit,
      order: [["createdAt", "DESC"]],
      include: [
        { model: User, as: "user", attributes: ["name", "email", "role"] },
      ],
    });

    res.render("admin/logs/index", {
      title: "Activity Logs",
      logs,
      totalLogs: logs.length,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    req.session.error = "Error loading logs";
    res.redirect("/admin/dashboard");
  }
});

module.exports = router;
