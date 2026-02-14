const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { Case, CaseDocument, User } = require("../models");
const path = require("path");
const fs = require("fs");
const GoogleDriveStorage = require("../config/googleDrive");

// Upload documents
router.post(
  "/cases/:id/upload",
  isAuthenticated,
  upload.array("documents", 10),
  async (req, res) => {
    try {
      console.log("Upload request received for case:", req.params.id);
      console.log("Files:", req.files);
      console.log("Body:", req.body);

      const caseData = await Case.findByPk(req.params.id);

      if (!caseData) {
        console.error("Case not found:", req.params.id);
        return res
          .status(404)
          .json({ success: false, message: "Case not found" });
      }

      // Check permission and read-only status
      // Check permission and read-only status
      if (
        !["admin", "super_admin"].includes(req.user.role) &&
        caseData.officer_id !== req.user.id &&
        caseData.field_officer_id !== req.user.id
      ) {
        console.error("Access denied for user:", req.user.id);
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      if (
        caseData.status === "closed" &&
        !["admin", "super_admin"].includes(req.user.role)
      ) {
        console.error("Case is closed:", req.params.id);
        return res
          .status(403)
          .json({ success: false, message: "Cannot upload to closed case" });
      }

      const { document_types, doc_source } = req.body;
      const files = req.files;

      if (!files || files.length === 0) {
        console.error("No files uploaded");
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }

      // Create document records - upload files in parallel for better performance
      const uploadPromises = files.map(async (file) => {
        // Generate unique filename
        const fileName = GoogleDriveStorage.generateFileName(
          "doc",
          file.originalname,
        );

        // Save to Google Drive in Cases/{CaseID}/Documents
        const result = await GoogleDriveStorage.uploadBuffer(
          file.buffer,
          fileName,
          file.mimetype,
          ["Cases", `Case_${caseData.case_id}`, "Documents"],
        );

        return {
          case_id: caseData.id,
          document_type: document_types,
          doc_source: doc_source || "investigation",
          file_name: file.originalname,
          file_path: result.filePath, // Store the local file path
          uploaded_by: req.user.id,
        };
      });

      // Wait for all uploads to complete in parallel
      const uploadResults = await Promise.all(uploadPromises);

      // Bulk create all document records at once
      const documents = await CaseDocument.bulkCreate(uploadResults);

      req.session.success = `${documents.length} document(s) uploaded successfully`;
      res.json({ success: true, message: "Documents uploaded", documents });
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error uploading documents",
      });
    }
  },
);

// View document (inline)
router.get("/:id/view", isAuthenticated, async (req, res) => {
  try {
    const document = await CaseDocument.findByPk(req.params.id, {
      include: [{ model: Case, as: "case" }],
    });

    if (!document) return res.status(404).send("Not Found");

    if (
      !["admin", "super_admin"].includes(req.user.role) &&
      document.case.officer_id !== req.user.id &&
      document.case.field_officer_id !== req.user.id
    ) {
      return res.status(403).send("Access Denied");
    }

    // Google Drive URL - use preview URL for viewing
    if (document.file_path.includes("drive.google.com")) {
      // Extract file ID and create preview URL
      const match = document.file_path.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) {
        const fileId = match[1];
        const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        return res.redirect(previewUrl);
      }
    }

    // Other cloud URL - redirect
    if (document.file_path.startsWith("http")) {
      return res.redirect(document.file_path);
    }

    // Local file - serve directly
    const filePath = path.resolve(document.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).send("File missing");

    res.sendFile(filePath);
  } catch (error) {
    console.error("Error viewing document:", error);
    res.status(500).send("Error");
  }
});

// Download document
router.get("/:id/download", isAuthenticated, async (req, res) => {
  try {
    const document = await CaseDocument.findByPk(req.params.id, {
      include: [{ model: Case, as: "case" }],
    });

    if (!document) {
      req.session.error = "Document not found";
      return res.redirect("/cases");
    }

    // Check access
    if (
      !["admin", "super_admin"].includes(req.user.role) &&
      document.case.officer_id !== req.user.id &&
      document.case.field_officer_id !== req.user.id
    ) {
      req.session.error = "Access denied";
      return res.redirect("/cases");
    }

    // Cloud URL - redirect
    if (document.file_path.startsWith("http")) {
      return res.redirect(document.file_path);
    }

    // Local file - download
    const filePath = path.resolve(document.file_path);

    if (!fs.existsSync(filePath)) {
      req.session.error = "File not found on disk";
      return res.redirect(`/cases/${document.case_id}`);
    }

    res.download(filePath, document.file_name);
  } catch (error) {
    console.error("Error downloading document:", error);
    req.session.error = "Error downloading document";
    res.redirect("/cases");
  }
});

// Delete document
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const document = await CaseDocument.findByPk(req.params.id, {
      include: [{ model: Case, as: "case" }],
    });

    if (!document) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    // Check permission
    if (
      !["admin", "super_admin"].includes(req.user.role) &&
      document.case.officer_id !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (
      document.case.status === "closed" &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Cannot delete from closed case" });
    }

    // Delete local file
    if (
      !document.file_path.startsWith("http") &&
      fs.existsSync(document.file_path)
    ) {
      fs.unlinkSync(document.file_path);
      console.log("Deleted local file:", document.file_path);
    }

    await document.destroy();

    req.session.success = "Document deleted successfully";
    res.json({ success: true, message: "Document deleted" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting document" });
  }
});

module.exports = router;
