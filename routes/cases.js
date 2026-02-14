const express = require("express");
const ExcelJS = require("exceljs");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const {
  Case,
  PatientDetail,
  HospitalDetail,
  PolicyDetail,
  BillDetail,
  DispatchDetail,
  InvestigationNote,
  Commission,
  CaseDocument,
  GeneratedReport,
  User,
  Company,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const { logActivity } = require("../helpers/auditLogger");

// Helper function to generate case ID
function generateCaseId() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `INV-${year}-${month}-${random}`;
}

// List all cases
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const { status, company, search } = req.query;
    const where = {};

    // Filter by officer for non-admin/non-super-admin/non-fo users
    if (!["admin", "super_admin", "field_officer"].includes(req.user.role)) {
      where.officer_id = req.user.id;
    }

    // Filter mainly for FOs
    if (req.user.role === "field_officer") {
      where.field_officer_id = req.user.id;
    }

    if (status) {
      where.status = status;
    }

    // Insurance company filter
    if (company) {
      where.insurance_company = { [Op.like]: `%${company}%` };
    }

    // Search filter
    if (search) {
      where.case_id = { [Op.like]: `%${search}%` };
    }

    const cases = await Case.findAll({
      where,
      include: [
        { model: User, as: "officer", attributes: ["name"] },
        { model: User, as: "fieldOfficer", attributes: ["name"] },
        { model: PatientDetail, as: "patientDetail" },
        { model: Commission, as: "commission" },
      ],
      order: [["createdAt", "DESC"]],
    });

    const companies = await Company.findAll({
      where: { active: true },
      order: [["name", "ASC"]],
    });

    res.render("cases/index", {
      title: "Cases",
      cases,
      companies,
      filters: { status, company, search },
    });
  } catch (error) {
    console.error("Error fetching cases:", error);
    req.session.error = "Error loading cases.";
    res.redirect("/");
  }
});

// New case form
router.get("/create", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role === "field_officer") {
      req.session.error = "Field Officers cannot create cases.";
      return res.redirect("/cases");
    }

    const companies = await Company.findAll({
      where: { active: true },
      order: [["name", "ASC"]],
    });

    const fieldOfficers = await User.findAll({
      where: { role: "field_officer" },
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });

    res.render("cases/create", {
      title: "New Investigation Case",
      companies,
      fieldOfficers,
    });
  } catch (error) {
    console.error("Error loading create case form:", error);
    req.session.error = "Error loading form";
    res.redirect("/cases");
  }
});

// Create new case
router.post("/", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role === "field_officer") {
      req.session.error = "Field Officers cannot create cases.";
      return res.redirect("/cases");
    }

    let { insurance_company, other_company } = req.body;

    if (!insurance_company) {
      req.session.error = "Insurance company is required.";
      return res.redirect("/cases/create");
    }

    // Handle "Other" selection
    if (insurance_company === "Other") {
      if (!other_company || other_company.trim() === "") {
        req.session.error = "Please specify the company name.";
        return res.redirect("/cases/create");
      }
      insurance_company = other_company.trim();
    }

    // Generate unique case ID
    let caseId;
    let isUnique = false;
    while (!isUnique) {
      caseId = generateCaseId();
      const existing = await Case.findOne({ where: { case_id: caseId } });
      if (!existing) isUnique = true;
    }

    // Sanitize field_officer_id
    let field_officer_id = null;
    if (req.body.field_officer_id && req.body.field_officer_id !== '') {
      field_officer_id = req.body.field_officer_id;
    }

    const newCase = await Case.create({
      case_id: caseId,
      officer_id: req.user.id,
      insurance_company,
      field_officer_id: req.body.field_officer_id || null, // Capture assigned FO
      status: "open",
    });

    req.session.success = `Case ${caseId} created successfully!`;
    res.redirect(`/cases/${newCase.id}`);

    // Log Activity
    logActivity(
      req,
      "CREATE_CASE",
      "Case",
      newCase.id,
      `Created case ${caseId} for ${insurance_company}`,
    );
  } catch (error) {
    console.error("Error creating case:", error);
    req.session.error = "Error creating case.";
    res.redirect("/cases/create");
  }
});

// User Dashboard
router.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const stats = {
      open: 0,
      in_progress: 0,
      closed: 0,
      total: 0,
    };

    const where = {};
    if (req.user.role === 'field_officer') {
      where.field_officer_id = req.user.id;
    } else if (!["admin", "super_admin"].includes(req.user.role)) {
      where.officer_id = req.user.id;
    }

    const caseStats = await Case.findAll({
      where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    caseStats.forEach((s) => {
      const count = parseInt(s.get("count"));
      stats[s.status] = count;
      stats.total += count;
    });

    // Get recent cases
    const recentCases = await Case.findAll({
      where,
      order: [["updatedAt", "DESC"]],
      limit: 5,
      include: [{ model: User, as: "officer", attributes: ["name"] }],
    });

    res.render("cases/dashboard", {
      title: "My Dashboard",
      stats,
      recentCases,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    req.session.error = "Error loading dashboard";
    res.redirect("/cases");
  }
});

// List companies JSON (Moved before /:id to prevent conflict)
router.get("/companies/list", isAuthenticated, async (req, res) => {
  try {
    const companies = await Company.findAll({
      where: { active: true },
      order: [["name", "ASC"]],
    });
    res.json({ success: true, companies });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// Export cases to Excel
router.get("/export/xlsx", isAuthenticated, async (req, res) => {
  try {
    const { status, company, search } = req.query;
    const where = {};

    // Filter by officer for non-admin/non-super-admin/non-fo users
    if (!["admin", "super_admin", "field_officer"].includes(req.user.role)) {
      where.officer_id = req.user.id;
    }

    // Hide closed cases from field officers
    if (req.user.role === "field_officer") {
      where.status = { [Op.ne]: "closed" };
    } else if (status) {
      where.status = status;
    }

    if (company) where.insurance_company = { [Op.like]: `%${company}%` };
    if (search) where.case_id = { [Op.like]: `%${search}%` };

    const cases = await Case.findAll({
      where,
      include: [
        { model: User, as: "officer", attributes: ["name"] },
        { model: PatientDetail, as: "patientDetail" },
        { model: HospitalDetail, as: "hospitalDetail" },
        { model: PolicyDetail, as: "policyDetail" },
        { model: InvestigationNote, as: "investigationNote" },
        { model: Commission, as: "commission" },
        { model: BillDetail, as: "billDetail" },
        { model: DispatchDetail, as: "dispatchDetail" },
        {
          model: GeneratedReport,
          as: "generatedReports",
          include: [{ model: User, as: "generator", attributes: ["name"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Cases");

    // Define columns based on 'EXCEL FORMAT.xlsx'
    worksheet.columns = [
      { header: "SR.NO", key: "sn", width: 5 },
      { header: "ALLO. DATE", key: "allo_date", width: 12 },
      { header: "REPORT SUB DATE", key: "report_sub_date", width: 12 },
      { header: "TAT", key: "tat", width: 5 }, // Calculated?
      { header: "INSURANCE COMPANY NAME", key: "insurance_company", width: 25 },
      { header: "TPA NAME", key: "tpa_name", width: 20 },
      { header: "CLAIM TYPE", key: "claim_type", width: 15 },
      { header: "POLICY TYPE (RETAIL/GROUP)", key: "policy_type", width: 20 },
      { header: "CLAIM NO", key: "claim_no", width: 15 },
      { header: "POLICY NO", key: "policy_no", width: 15 },
      { header: "INSURED NAME", key: "insured_name", width: 20 },
      { header: "PATIENT NAME", key: "patient_name", width: 20 },
      { header: "ADDRESS 1", key: "address", width: 30 }, // Patient address
      { header: "CITY", key: "p_city", width: 15 }, // Patient city
      { header: "MOB. NO.", key: "mobile", width: 12 },
      { header: "HOSPITAL NAME", key: "hospital_name", width: 25 },
      { header: "HOSPITAL ADDRESS", key: "h_address", width: 30 },
      { header: "CITY", key: "h_city", width: 15 },
      { header: "BED", key: "bed", width: 10 },
      { header: "HOS. REG. NO.", key: "h_reg", width: 15 },
      { header: "PHONE NO.", key: "h_phone", width: 12 },
      { header: "DR. NAME", key: "doc_name", width: 15 },
      { header: "DR. REG. NO.", key: "doc_reg", width: 15 },
      { header: "PATHOLOGY CENTER", key: "path_center", width: 20 },
      { header: "PATHOLOGY DOCTOR NAME", key: "path_doc", width: 15 },
      { header: "PATHOLOGIST REG. NO.", key: "path_reg", width: 15 },
      { header: "MEDICAL STORE", key: "med_store", width: 15 },
      { header: "DOA", key: "doa", width: 12 },
      { header: "DOD", key: "dod", width: 12 },
      { header: "DIGONSIS", key: "diagnosis", width: 20 },
      { header: "CLAIM AMT", key: "claim_amt", width: 12 },
      { header: "CASE ALLOCATE 1", key: "officer1", width: 15 },
      { header: "CASE ALLOCATED 2", key: "officer2", width: 15 },
      { header: "FO EXPENSE APPROVED", key: "fo_expense", width: 15 },
      { header: "QC MANAGER", key: "qc_manager", width: 15 },
      { header: "STATUS", key: "status", width: 10 },
      { header: "GST BILL", key: "gst_bill", width: 10 },
      { header: "BILL NO", key: "bill_no", width: 15 },
      { header: "MRD CHARGE", key: "mrd", width: 10 },
      { header: "EXPENSE COMPANY APPROVED", key: "comp_expense", width: 15 },
      { header: "TOTAL BILL AMOUNT", key: "total_bill", width: 15 },
      { header: "PAYMENT RECE DATE", key: "pay_date", width: 15 },
      { header: "RECEIVED AMT", key: "rec_amt", width: 15 },
      { header: "OTHER", key: "other_exp", width: 20 },
      { header: "CASE REMARK", key: "remark", width: 25 },
      { header: "HID NO.", key: "hid", width: 15 }, // Assuming same as ID or custom
      { header: "HARD COPY SUB DATE", key: "hard_submit", width: 15 },
      { header: "SEND NAME AND ADDRESS", key: "sender_addr", width: 25 },
      { header: "COURIER NAME", key: "courier", width: 15 },
      { header: "POD NO.", key: "pod", width: 15 },
    ];

    // Add Data
    cases.forEach((c, index) => {
      worksheet.addRow({
        sn: index + 1,
        allo_date: new Date(c.createdAt).toLocaleDateString("en-IN"), // Assuming Allocation Date = Created Date
        report_sub_date: "-", // Not tracked explicitly yet?
        tat: "-", // logic needing dates
        insurance_company: c.insurance_company,
        tpa_name: c.policyDetail?.tpa_name || "-",
        claim_type: c.policyDetail?.claim_type || "-",
        policy_type: c.policyDetail?.policy_type || "-",
        claim_no: c.policyDetail?.claim_number || "-",
        policy_no: c.policyDetail?.policy_number || "-",
        insured_name: c.patientDetail?.insured_name || "-",
        patient_name: c.patientDetail?.name || "-",
        address: c.patientDetail?.address || "-",
        p_city: c.patientDetail?.city || "-",
        mobile: c.patientDetail?.mobile_number || "-",
        hospital_name: c.hospitalDetail?.hospital_name || "-",
        h_address: c.hospitalDetail?.address || "-",
        h_city: c.hospitalDetail?.city || "-",
        bed: c.hospitalDetail?.bed_number || "-",
        h_reg: c.hospitalDetail?.registration_number || "-",
        h_phone: c.hospitalDetail?.contact_number || "-",
        doc_name: c.hospitalDetail?.doctor_name || "-",
        doc_reg: c.hospitalDetail?.doctor_registration_number || "-",
        path_center: c.hospitalDetail?.pathology_center || "-",
        path_doc: c.hospitalDetail?.pathology_doctor_name || "-",
        path_reg: c.hospitalDetail?.pathologist_registration_number || "-",
        med_store: c.hospitalDetail?.medical_store || "-",
        doa: c.patientDetail?.admission_date || "-",
        dod: c.patientDetail?.discharge_date || "-",
        diagnosis: c.diagnosis || "-",
        claim_amt: c.policyDetail?.claim_amount || 0,
        officer1: c.officer?.name || "-",
        officer2: c.secondOfficer?.name || "-", // Need to include in query
        fo_expense: c.billDetail?.approved_expense_fo || 0,
        qc_manager: c.qc_manager || "-",
        status: c.status,
        gst_bill: c.billDetail?.gst_bill || "-",
        bill_no: c.billDetail?.bill_number || "-",
        mrd: c.billDetail?.mrd_charge || 0,
        comp_expense: c.billDetail?.approved_expense_company || 0,
        total_bill: c.billDetail?.total_bill_amount || 0,
        pay_date: c.billDetail?.payment_received_date || "-",
        rec_amt: c.billDetail?.received_amount || 0,
        other_exp: c.billDetail?.other_expenses || "-",
        remark: c.case_remark || "-",
        hid: c.case_id,
        hard_submit: c.dispatchDetail?.hard_copy_submit_date || "-",
        sender_addr: c.dispatchDetail?.sender_name_address || "-",
        courier: c.dispatchDetail?.courier_name || "-",
        pod: c.dispatchDetail?.pod_number || "-",
      });
    });

    // Styling headers
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=cases_export_${new Date().toISOString().split("T")[0]}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting cases:", error);
    req.session.error = "Error exporting cases.";
    res.redirect("/cases");
  }
});

// View case details
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id, {
      include: [
        { model: User, as: "officer" },
        { model: User, as: "fieldOfficer" },
        { model: PatientDetail, as: "patientDetail" },
        { model: HospitalDetail, as: "hospitalDetail" },
        { model: PolicyDetail, as: "policyDetail" },
        { model: InvestigationNote, as: "investigationNote" },
        { model: Commission, as: "commission" },
        { model: BillDetail, as: "billDetail" },
        { model: DispatchDetail, as: "dispatchDetail" },
        {
          model: CaseDocument,
          as: "documents",
          include: [{ model: User, as: "uploader", attributes: ["name"] }],
        },
        {
          model: GeneratedReport,
          as: "generatedReports",
          include: [{ model: User, as: "generator", attributes: ["name"] }],
        },
      ],
    });

    if (!caseData) {
      req.session.error = "Case not found.";
      return res.redirect("/cases");
    }

    // Check access permission
    if (
      !["admin", "super_admin", "field_officer"].includes(req.user.role) &&
      caseData.officer_id !== req.user.id
    ) {
      req.session.error = "You do not have access to this case.";
      return res.redirect("/cases");
    }

    // Allow FO if assigned
    if (req.user.role === 'field_officer' && caseData.field_officer_id !== req.user.id) {
      req.session.error = "You do not have access to this case.";
      return res.redirect("/cases");
    }

    // Block field officers from viewing closed cases - REMOVED per robust requirements
    // if (req.user.role === "field_officer" && caseData.status === "closed") {
    //   req.session.error = "This case is closed and no longer accessible.";
    //   return res.redirect("/cases");
    // }

    // Check if case is read-only
    const isReadOnly =
      (caseData.status === "closed" &&
        !["admin", "super_admin"].includes(req.user.role)) ||
      req.user.role === "field_officer";

    // DEBUG LOGGING
    console.log("DEBUG: Case Data retrieved.");
    console.log("Commission:", caseData.commission ? "Found" : "Null");
    console.log(
      "Reports:",
      caseData.generatedReports
        ? caseData.generatedReports.length
        : "Undefined",
    );
    console.log("BillDetail:", caseData.billDetail ? "Found" : "Null");

    // Fetch FOs for admin assignment in edit modal
    let fieldOfficers = [];
    if (["admin", "super_admin"].includes(req.user.role)) {
      fieldOfficers = await User.findAll({
        where: { role: "field_officer" },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      });
    }

    res.render("cases/show", {
      title: `Case ${caseData.case_id}`,
      caseData: caseData,
      isReadOnly,
      fieldOfficers,
    });
  } catch (error) {
    console.error("Error fetching case:", error);
    req.session.error = "Error loading case.";
    res.redirect("/cases");
  }
});

// Update case details (Core)
router.post("/:id/update-details", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (
      !caseData ||
      (!["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id)
    ) {
      return res.status(403).json({ success: false });
    }

    const { insurance_company, officer_id, field_officer_id } = req.body;
    if (insurance_company) caseData.insurance_company = insurance_company;
    if (officer_id && ["admin", "super_admin"].includes(req.user.role))
      caseData.officer_id = officer_id;
    if (field_officer_id !== undefined && ["admin", "super_admin"].includes(req.user.role))
      caseData.field_officer_id = field_officer_id === "" ? null : field_officer_id;

    await caseData.save();

    logActivity(
      req,
      "UPDATE_CASE",
      "Case",
      caseData.id,
      "Updated case details (Company/Officer)",
    );

    req.session.success = "Case details updated";
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating details:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update case status
router.post("/:id/status", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);

    if (!caseData) {
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });
    }

    // Check permission
    if (
      !["admin", "super_admin"].includes(req.user.role) &&
      caseData.officer_id !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { status } = req.body;

    if (!["open", "in_progress", "closed"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    caseData.status = status;
    await caseData.save();

    logActivity(
      req,
      "UPDATE_STATUS",
      "Case",
      caseData.id,
      `Changed status to ${status}`,
    );

    req.session.success = `Case status updated to ${status}`;
    res.json({ success: true, message: `Case marked as ${status}` });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating status: " + error.message,
    });
  }
});

// Save patient details
router.post("/:id/patient", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (
      !caseData ||
      (!["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      caseData.status === "closed" &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Case is closed" });
    }

    const {
      name,
      age,
      gender,
      address,
      aadhaar_number,
      admission_date,
      discharge_date,
      insured_name,
      mobile_number,
      city,
    } = req.body;

    const existing = await PatientDetail.findOne({
      where: { case_id: caseData.id },
    });

    if (existing) {
      await existing.update({
        name,
        age,
        gender,
        address,
        aadhaar_number,
        admission_date,
        discharge_date,
        insured_name,
        mobile_number,
        city,
      });
    } else {
      await PatientDetail.create({
        case_id: caseData.id,
        name,
        age,
        gender,
        address,
        aadhaar_number,
        admission_date,
        discharge_date,
        insured_name,
        mobile_number,
        city,
      });
    }

    logActivity(
      req,
      "UPDATE_PATIENT",
      "Case",
      caseData.id,
      `Updated patient: ${name}`,
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving patient details:", error);
    res.status(500).json({
      success: false,
      message: "Error saving patient details: " + error.message,
    });
  }
});

// Save hospital details
router.post("/:id/hospital", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (
      !caseData ||
      (!["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      caseData.status === "closed" &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Case is closed" });
    }

    const {
      hospital_name,
      address,
      registration_number,
      doctor_name,
      city,
      bed_number,
      contact_number,
      doctor_registration_number,
      pathology_center,
      pathology_doctor_name,
      pathologist_registration_number,
      medical_store,
      total_beds,
      accommodation_class,
      icu_beds,
      ot_count,
      rmo_count,
      nursing_staff_count,
      doctor_qualification,
      doctor_contact,
      pharmacy_dl_number,
      pharmacy_gst_number,
    } = req.body;

    // Helper to convert empty strings to null for integer fields
    const toIntOrNull = (val) =>
      val === "" || val === undefined || val === null
        ? null
        : parseInt(val, 10);

    // Sanitize integer fields
    const sanitizedData = {
      hospital_name,
      address,
      registration_number,
      doctor_name,
      city,
      bed_number,
      contact_number,
      doctor_registration_number,
      pathology_center,
      pathology_doctor_name,
      pathologist_registration_number,
      medical_store,
      total_beds: toIntOrNull(total_beds),
      accommodation_class,
      icu_beds: toIntOrNull(icu_beds),
      ot_count: toIntOrNull(ot_count),
      rmo_count: toIntOrNull(rmo_count),
      nursing_staff_count: toIntOrNull(nursing_staff_count),
      doctor_qualification,
      doctor_contact,
      pharmacy_dl_number,
      pharmacy_gst_number,
    };

    const existing = await HospitalDetail.findOne({
      where: { case_id: caseData.id },
    });

    if (existing) {
      await existing.update(sanitizedData);
    } else {
      await HospitalDetail.create({
        case_id: caseData.id,
        ...sanitizedData,
      });
    }

    logActivity(
      req,
      "UPDATE_HOSPITAL",
      "Case",
      caseData.id,
      `Updated hospital: ${hospital_name}`,
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving hospital details:", error);
    res.status(500).json({
      success: false,
      message: "Error saving hospital details: " + error.message,
    });
  }
});

// Save policy details
router.post("/:id/policy", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (
      !caseData ||
      (!["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      caseData.status === "closed" &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Case is closed" });
    }

    const {
      insurance_company,
      policy_number,
      policy_type,
      sum_insured,
      claim_type,
      claim_amount,
      tpa_name,
      claim_number,
      date_of_visit,
      retail_or_corporate,
    } = req.body;

    // Sanitize optional numeric fields
    const sanitizedData = {
      insurance_company,
      policy_number,
      policy_type,
      sum_insured: sum_insured === "" ? null : sum_insured,
      claim_type,
      claim_amount: claim_amount === "" ? null : claim_amount,
      tpa_name,
      claim_number,
      date_of_visit: date_of_visit === "" ? null : date_of_visit,
      retail_or_corporate,
    };

    const existing = await PolicyDetail.findOne({
      where: { case_id: caseData.id },
    });

    if (existing) {
      await existing.update(sanitizedData);
    } else {
      await PolicyDetail.create({
        case_id: caseData.id,
        ...sanitizedData,
      });
    }

    logActivity(
      req,
      "UPDATE_POLICY",
      "Case",
      caseData.id,
      `Updated policy: ${policy_number}`,
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving policy details:", error);
    res.status(500).json({
      success: false,
      message: "Error saving policy details: " + error.message,
    });
  }
});

// Save investigation notes
router.post("/:id/investigation", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (
      !caseData ||
      (!["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      caseData.status === "closed" &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Case is closed" });
    }

    const {
      findings,
      observations,
      red_flags,
      supporting_notes,
      trigger,
      hospital_visit_findings,
      doctor_visit_findings,
      insured_visit_findings,
      pharmacy_visit_findings,
      lab_visit_findings,
      brief_description,
      diagnosis,
      conclusion,
    } = req.body;

    const noteData = {
      findings,
      observations,
      red_flags,
      supporting_notes,
      trigger,
      hospital_visit_findings,
      doctor_visit_findings,
      insured_visit_findings,
      pharmacy_visit_findings,
      lab_visit_findings,
      brief_description,
      diagnosis,
      conclusion,
    };

    const existing = await InvestigationNote.findOne({
      where: { case_id: caseData.id },
    });

    if (existing) {
      await existing.update(noteData);
    } else {
      await InvestigationNote.create({
        case_id: caseData.id,
        ...noteData,
      });
    }

    logActivity(
      req,
      "UPDATE_NOTES",
      "Case",
      caseData.id,
      "Updated investigation notes",
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving investigation notes:", error);
    res.status(500).json({
      success: false,
      message: "Error saving investigation notes: " + error.message,
    });
  }
});

// Save commission details
router.post("/:id/commission", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: Only admins and super admins can manage commissions",
      });
    }

    const { commission_type, amount, notes, status } = req.body;

    const existing = await Commission.findOne({
      where: { case_id: caseData.id },
    });

    if (existing) {
      await existing.update({ commission_type, amount, notes, status });
    } else {
      await Commission.create({
        case_id: caseData.id,
        commission_type,
        amount,
        notes,
        status,
      });
    }

    logActivity(
      req,
      "UPDATE_COMMISSION",
      "Case",
      caseData.id,
      `Updated commission: ${amount} (${status})`,
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving commission details:", error);
    res.status(500).json({
      success: false,
      message: "Error saving commission details: " + error.message,
    });
  }
});

// Save billing details
router.post("/:id/billing", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (
      !caseData ||
      (!["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      caseData.status === "closed" &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Case is closed" });
    }

    const {
      gst_bill,
      bill_number,
      mrd_charge,
      approved_expense_company,
      approved_expense_fo,
      total_bill_amount,
      payment_received_date,
      received_amount,
      other_expenses,
    } = req.body;

    const existing = await BillDetail.findOne({
      where: { case_id: caseData.id },
    });

    if (existing) {
      await existing.update({
        gst_bill,
        bill_number,
        mrd_charge,
        approved_expense_company,
        approved_expense_fo,
        total_bill_amount,
        payment_received_date,
        received_amount,
        other_expenses,
      });
    } else {
      await BillDetail.create({
        case_id: caseData.id,
        gst_bill,
        bill_number,
        mrd_charge,
        approved_expense_company,
        approved_expense_fo,
        total_bill_amount,
        payment_received_date,
        received_amount,
        other_expenses,
      });
    }

    logActivity(
      req,
      "UPDATE_BILLING",
      "Case",
      caseData.id,
      "Updated billing details",
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving billing details:", error);
    res.status(500).json({
      success: false,
      message: "Error saving billing details: " + error.message,
    });
  }
});

// Save dispatch details
router.post("/:id/dispatch", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);
    if (
      !caseData ||
      (!["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      caseData.status === "closed" &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Case is closed" });
    }

    const {
      hard_copy_submit_date,
      sender_name_address,
      courier_name,
      pod_number,
    } = req.body;

    const existing = await DispatchDetail.findOne({
      where: { case_id: caseData.id },
    });

    if (existing) {
      await existing.update({
        hard_copy_submit_date,
        sender_name_address,
        courier_name,
        pod_number,
      });
    } else {
      await DispatchDetail.create({
        case_id: caseData.id,
        hard_copy_submit_date,
        sender_name_address,
        courier_name,
        pod_number,
      });
    }

    logActivity(
      req,
      "UPDATE_DISPATCH",
      "Case",
      caseData.id,
      "Updated dispatch details",
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving dispatch details:", error);
    res.status(500).json({
      success: false,
      message: "Error saving dispatch details: " + error.message,
    });
  }
});

// Delete case - Admin/Super Admin only
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can delete cases.",
      });
    }

    const caseData = await Case.findByPk(req.params.id);

    if (!caseData) {
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });
    }

    // Delete all related records first (in proper order to avoid FK constraints)
    await CaseDocument.destroy({ where: { case_id: caseData.id } });
    await GeneratedReport.destroy({ where: { case_id: caseData.id } });
    await Commission.destroy({ where: { case_id: caseData.id } });
    await BillDetail.destroy({ where: { case_id: caseData.id } });
    await DispatchDetail.destroy({ where: { case_id: caseData.id } });
    await InvestigationNote.destroy({ where: { case_id: caseData.id } });
    await PolicyDetail.destroy({ where: { case_id: caseData.id } });
    await HospitalDetail.destroy({ where: { case_id: caseData.id } });
    await PatientDetail.destroy({ where: { case_id: caseData.id } });

    // Log activity before deleting the case
    logActivity(
      req,
      "DELETE_CASE",
      "Case",
      caseData.id,
      `Deleted case ${caseData.case_id}`,
    );

    // Delete the case
    await caseData.destroy();

    res.json({ success: true, message: "Case deleted successfully" });
  } catch (error) {
    console.error("Error deleting case:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting case: " + error.message,
    });
  }
});

module.exports = router;
