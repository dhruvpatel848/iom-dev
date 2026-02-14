const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const {
  Case,
  ReportTemplate,
  GeneratedReport,
  PatientDetail,
  HospitalDetail,
  PolicyDetail,
  InvestigationNote,
  Commission,

  BillDetail,
} = require("../models");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");
const GoogleDriveStorage = require("../config/googleDrive");
const axios = require("axios");

// Report generation form
router.get("/cases/:id/create", isAuthenticated, async (req, res) => {
  try {
    const caseData = await Case.findByPk(req.params.id);

    if (!caseData) {
      req.session.error = "Case not found";
      return res.redirect("/cases");
    }

    // Check access - admins and super_admins have full access
    if (
      !["admin", "super_admin"].includes(req.user.role) &&
      caseData.officer_id !== req.user.id
    ) {
      req.session.error = "Access denied";
      return res.redirect("/cases");
    }

    // Get templates for this insurance company
    const templates = await ReportTemplate.findAll({
      where: { insurance_company: caseData.insurance_company },
    });

    res.render("reports/create", {
      title: "Generate Report",
      caseData: caseData,
      templates,
    });
  } catch (error) {
    console.error("Error loading report form:", error);
    req.session.error = "Error loading report generation form";
    res.redirect("/cases");
  }
});

// Generate report
router.post("/cases/:id/generate", isAuthenticated, async (req, res) => {
  try {
    const { template_id, conclusion, recommendation } = req.body;

    if (!template_id || !conclusion || !recommendation) {
      req.session.error =
        "Template, conclusion, and recommendation are required";
      return res.redirect(`/reports/cases/${req.params.id}/create`);
    }

    // Fetch case with all details
    const caseData = await Case.findByPk(req.params.id, {
      include: [
        { model: PatientDetail, as: "patientDetail" },
        { model: HospitalDetail, as: "hospitalDetail" },
        { model: PolicyDetail, as: "policyDetail" },
        { model: InvestigationNote, as: "investigationNote" },
        { model: Commission, as: "commission" },

        { model: BillDetail, as: "billDetail" },
      ],
    });

    if (!caseData) {
      req.session.error = "Case not found";
      return res.redirect("/cases");
    }

    // Check access - admins and super_admins have full access
    if (
      !["admin", "super_admin"].includes(req.user.role) &&
      caseData.officer_id !== req.user.id
    ) {
      req.session.error = "Access denied";
      return res.redirect("/cases");
    }

    const template = await ReportTemplate.findByPk(template_id);
    if (!template) {
      req.session.error = "Template not found";
      return res.redirect(`/reports/cases/${req.params.id}/create`);
    }

    // Prepare data for placeholders
    const reportData = {
      case_id: caseData.case_id,
      insurance_company: caseData.insurance_company,
      patient_name: caseData.patientDetail?.name || "",
      patient_age: caseData.patientDetail?.age || "",
      patient_gender: caseData.patientDetail?.gender || "",
      patient_address: caseData.patientDetail?.address || "",
      patient_aadhaar: caseData.patientDetail?.aadhaar_number || "",
      admission_date: caseData.patientDetail?.admission_date || "",
      discharge_date: caseData.patientDetail?.discharge_date || "",
      hospital_name: caseData.hospitalDetail?.hospital_name || "",
      hospital_address: caseData.hospitalDetail?.address || "",
      hospital_registration: caseData.hospitalDetail?.registration_number || "",
      total_beds: caseData.hospitalDetail?.total_beds || "",
      accommodation_class: caseData.hospitalDetail?.accommodation_class || "",
      doctor_name: caseData.hospitalDetail?.doctor_name || "",
      doctor_registration_number:
        caseData.hospitalDetail?.doctor_registration_number || "",
      // New Hospital Infrastructure fields
      icu_beds: caseData.hospitalDetail?.icu_beds || "",
      ot_count: caseData.hospitalDetail?.ot_count || "",
      rmo_count: caseData.hospitalDetail?.rmo_count || "",
      nursing_staff_count: caseData.hospitalDetail?.nursing_staff_count || "",
      // New Doctor Details
      doctor_qualification: caseData.hospitalDetail?.doctor_qualification || "",
      doctor_contact: caseData.hospitalDetail?.doctor_contact || "",
      // Pathology Details
      pathology_center: caseData.hospitalDetail?.pathology_center || "",
      pathology_doctor_name:
        caseData.hospitalDetail?.pathology_doctor_name || "",
      pathologist_registration_number:
        caseData.hospitalDetail?.pathologist_registration_number || "",
      // Pharmacy Details
      medical_store: caseData.hospitalDetail?.medical_store || "",
      pharmacy_dl_number: caseData.hospitalDetail?.pharmacy_dl_number || "",
      pharmacy_gst_number: caseData.hospitalDetail?.pharmacy_gst_number || "",
      // Policy Details
      policy_number: caseData.policyDetail?.policy_number || "",
      policy_type: caseData.policyDetail?.policy_type || "",
      sum_insured: caseData.policyDetail?.sum_insured || "",
      claim_type: caseData.policyDetail?.claim_type || "",
      claim_amount: caseData.policyDetail?.claim_amount || "",
      claim_number: caseData.policyDetail?.claim_number || "",
      tpa_name: caseData.policyDetail?.tpa_name || "",
      date_of_visit: caseData.policyDetail?.date_of_visit || "",
      retail_or_corporate: caseData.policyDetail?.retail_or_corporate || "",
      // Billing
      approved_expense_company:
        caseData.billDetail?.approved_expense_company || "",
      approved_expense_fo: caseData.billDetail?.approved_expense_fo || "",
      // Investigation Notes (existing)
      investigation_findings: caseData.investigationNote?.findings || "",
      observations: caseData.investigationNote?.observations || "",
      trigger: caseData.investigationNote?.trigger || "",
      red_flags: caseData.investigationNote?.red_flags || "",
      supporting_notes: caseData.investigationNote?.supporting_notes || "",
      // New Investigation Visit Findings
      hospital_visit_findings:
        caseData.investigationNote?.hospital_visit_findings || "",
      doctor_visit_findings:
        caseData.investigationNote?.doctor_visit_findings || "",
      insured_visit_findings:
        caseData.investigationNote?.insured_visit_findings || "",
      pharmacy_visit_findings:
        caseData.investigationNote?.pharmacy_visit_findings || "",
      lab_visit_findings: caseData.investigationNote?.lab_visit_findings || "",
      // New Case Summary fields
      diagnosis: caseData.investigationNote?.diagnosis || "",
      brief_description: caseData.investigationNote?.brief_description || "",
      investigation_conclusion: caseData.investigationNote?.conclusion || "",
      // Report fields
      conclusion,
      recommendation,
      officer_name: req.user.name,
      generated_date: new Date().toLocaleDateString("en-IN"),
    };

    let filePath;

    if (template.file_path) {
      let content;
      // Check if it's a cloud URL
      if (template.file_path.startsWith("http")) {
        // Download template from cloud
        try {
          let downloadUrl = template.file_path;

          // Handle Google Drive URLs - convert to direct download format
          if (template.file_path.includes("drive.google.com")) {
            const match =
              template.file_path.match(/id=([a-zA-Z0-9_-]+)/) ||
              template.file_path.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) {
              const fileId = match[1];
              // Use the export format that works for binary files
              downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
            }
          }

          const response = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
            maxRedirects: 5,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });
          content = Buffer.from(response.data);
        } catch (err) {
          console.error("Error downloading template:", err.message);
          req.session.error = "Error downloading template file: " + err.message;
          return res.redirect(`/reports/cases/${req.params.id}/create`);
        }
      } else {
        // Local file (fallback)
        if (!fs.existsSync(template.file_path)) {
          req.session.error = "Template file not found";
          return res.redirect(`/reports/cases/${req.params.id}/create`);
        }
        content = fs.readFileSync(template.file_path, "binary");
      }

      // Ensure it is a .docx file (check URL or template name for cloud files)
      const isDocx =
        template.file_path.toLowerCase().endsWith(".docx") ||
        template.file_path.includes("drive.google.com") ||
        (template.template_name &&
          template.template_name.toLowerCase().includes("imported"));

      if (!isDocx && !template.file_path.startsWith("http")) {
        req.session.error =
          "Invalid template file format. Only .docx is supported.";
        return res.redirect(`/reports/cases/${req.params.id}/create`);
      }

      // Generate using Docxtemplater
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Clean null/undefined values for docxtemplater
      const safeData = {};
      Object.keys(reportData).forEach((key) => {
        safeData[key] = reportData[key] || "";
      });

      doc.render(safeData);

      const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      });

      // Save to Google Drive in Cases/{CaseID}/Reports
      const fileName = `Report_${caseData.case_id}_${Date.now()}.docx`;
      const result = await GoogleDriveStorage.uploadBuffer(
        buf,
        fileName,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ["Cases", `Case_${caseData.case_id}`, "Reports"],
      );
      filePath = result.filePath;
    } else {
      // Fallback to HTML-to-Doc generation for legacy templates

      // Generate professional HTML report
      let content = template.template_content;
      Object.keys(reportData).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, "g");
        content = content.replace(regex, reportData[key] || "");
      });

      const htmlContent = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <meta charset="utf-8">
                    <title>Investigation Report</title>
                    <style>
                        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        h1 { font-size: 24px; color: #2c3e50; margin: 0; }
                        .meta { margin-bottom: 20px; font-size: 14px; color: #555; }
                        .section { margin-bottom: 25px; }
                        .section-title { font-size: 18px; font-weight: bold; color: #2980b9; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
                        .content { white-space: pre-wrap; }
                        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Investigation Report</h1>
                        <p>${reportData.insurance_company}</p>
                    </div>
                    
                    <div class="meta">
                        <table style="border: none;">
                            <tr style="border: none;"><td style="border: none;"><strong>Case ID:</strong> ${reportData.case_id}</td><td style="border: none;"><strong>Date:</strong> ${reportData.generated_date}</td></tr>
                            <tr style="border: none;"><td style="border: none;"><strong>Officer:</strong> ${reportData.officer_name}</td><td style="border: none;"></td></tr>
                        </table>
                    </div>

                    <div class="section">
                        <div class="content">
                            ${content.replace(/\n/g, "<br>")}
                        </div>
                    </div>

                    <div class="footer">
                        Generated by Investigation Management System
                    </div>
                </body>
                </html>
            `;

      // Save as .doc (Word recognized HTML) - Save to local storage
      // Save as .doc (Word recognized HTML) - Save to Google Drive in Cases/{CaseID}/Reports
      const fileName = `Report_${caseData.case_id}_${Date.now()}.doc`;
      const result = await GoogleDriveStorage.uploadBuffer(
        Buffer.from(htmlContent),
        fileName,
        "application/msword",
        ["Cases", `Case_${caseData.case_id}`, "Reports"],
      );
      filePath = result.filePath;
    }

    // Save report record
    const report = await GeneratedReport.create({
      case_id: caseData.id,
      template_id,
      file_path: filePath,
      generated_by: req.user.id,
      conclusion,
      recommendation,
    });

    req.session.success = "Report generated successfully";
    // Redirect to case page - Reports tab will show the new report
    req.session.save(() => {
      res.redirect(`/cases/${caseData.id}?tab=reports`);
    });
  } catch (error) {
    console.error("Error generating report:", error);
    req.session.error = "Error generating report";
    req.session.save(() => {
      res.redirect(`/reports/cases/${req.params.id}/create`);
    });
  }
});

// Download generated report
router.get("/:id/download", isAuthenticated, async (req, res) => {
  try {
    const report = await GeneratedReport.findByPk(req.params.id, {
      include: [{ model: Case, as: "case" }],
    });

    if (!report) {
      req.session.error = "Report not found";
      return res.redirect("/cases");
    }

    // Check access - admins and super_admins have full access
    if (
      !["admin", "super_admin"].includes(req.user.role) &&
      report.case.officer_id !== req.user.id
    ) {
      req.session.error = "Access denied";
      return res.redirect("/cases");
    }

    // If it's a cloud URL, redirect to it
    if (report.file_path.startsWith("http")) {
      return res.redirect(report.file_path);
    }

    // Fallback for local files
    if (!fs.existsSync(report.file_path)) {
      req.session.error = "Report file not found";
      return res.redirect(`/cases/${report.case_id}`);
    }

    res.download(report.file_path);
  } catch (error) {
    console.error("Error downloading report:", error);
    req.session.error = "Error downloading report";
    res.redirect("/cases");
  }
});

// Delete generated report - Admin/Super Admin only
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied. Only admins can delete reports.",
        });
    }

    const report = await GeneratedReport.findByPk(req.params.id, {
      include: [{ model: Case, as: "case" }],
    });

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    // Delete the file from Google Drive if it's a cloud URL
    if (report.file_path && report.file_path.startsWith("http")) {
      try {
        // Extract file ID from Google Drive URL
        const match =
          report.file_path.match(/id=([a-zA-Z0-9_-]+)/) ||
          report.file_path.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
          const fileId = match[1];
          await GoogleDriveStorage.deleteFile(fileId);
        }
      } catch (driveError) {
        console.error("Error deleting file from Google Drive:", driveError);
        // Continue with database deletion even if Drive deletion fails
      }
    }

    // Delete the report record from database
    await report.destroy();

    res.json({ success: true, message: "Report deleted successfully" });
  } catch (error) {
    console.error("Error deleting report:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error deleting report: " + error.message,
      });
  }
});

module.exports = router;
