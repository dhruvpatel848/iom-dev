const sequelize = require("../config/database");

// Import models
const User = require("./User");
const Case = require("./Case");
const PatientDetail = require("./PatientDetail");
const HospitalDetail = require("./HospitalDetail");
const PolicyDetail = require("./PolicyDetail");
const CaseDocument = require("./CaseDocument");
const InvestigationNote = require("./InvestigationNote");
const Commission = require("./Commission");
const ReportTemplate = require("./ReportTemplate");
const GeneratedReport = require("./GeneratedReport");
const Company = require("./Company");
const BillDetail = require("./BillDetail");
const DispatchDetail = require("./DispatchDetail");
const License = require("./License");
const AuditLog = require("./AuditLog");

// Define relationships

// User relationships
User.hasMany(Case, { foreignKey: "officer_id", as: "cases" });
User.hasMany(Case, { foreignKey: "officer_id_2", as: "secondOfficerCases" });
User.hasMany(Case, { foreignKey: "field_officer_id", as: "fieldOfficerCases" });

User.hasMany(CaseDocument, {
  foreignKey: "uploaded_by",
  as: "uploadedDocuments",
});
User.hasMany(ReportTemplate, {
  foreignKey: "created_by",
  as: "createdTemplates",
});
User.hasMany(GeneratedReport, {
  foreignKey: "generated_by",
  as: "generatedReports",
});

// Case relationships
Case.belongsTo(User, { foreignKey: "officer_id", as: "officer" });
Case.belongsTo(User, { foreignKey: "officer_id_2", as: "secondOfficer" });
Case.belongsTo(User, { foreignKey: "field_officer_id", as: "fieldOfficer" });
Case.hasOne(PatientDetail, { foreignKey: "case_id", as: "patientDetail" });
Case.hasOne(HospitalDetail, { foreignKey: "case_id", as: "hospitalDetail" });
Case.hasOne(PolicyDetail, { foreignKey: "case_id", as: "policyDetail" });
Case.hasOne(BillDetail, { foreignKey: "case_id", as: "billDetail" });
Case.hasOne(DispatchDetail, { foreignKey: "case_id", as: "dispatchDetail" });
Case.hasMany(CaseDocument, { foreignKey: "case_id", as: "documents" });
Case.hasOne(InvestigationNote, {
  foreignKey: "case_id",
  as: "investigationNote",
});
Case.hasOne(Commission, { foreignKey: "case_id", as: "commission" });
Case.hasMany(GeneratedReport, {
  foreignKey: "case_id",
  as: "generatedReports",
});

// PatientDetail relationships
PatientDetail.belongsTo(Case, { foreignKey: "case_id", as: "case" });

// HospitalDetail relationships
HospitalDetail.belongsTo(Case, { foreignKey: "case_id", as: "case" });

// PolicyDetail relationships
PolicyDetail.belongsTo(Case, { foreignKey: "case_id", as: "case" });

// BillDetail relationships
BillDetail.belongsTo(Case, { foreignKey: "case_id", as: "case" });

// DispatchDetail relationships
DispatchDetail.belongsTo(Case, { foreignKey: "case_id", as: "case" });
// CaseDocument relationships
CaseDocument.belongsTo(Case, { foreignKey: "case_id", as: "case" });
CaseDocument.belongsTo(User, { foreignKey: "uploaded_by", as: "uploader" });

// InvestigationNote relationships
InvestigationNote.belongsTo(Case, { foreignKey: "case_id", as: "case" });

// Commission relationships
Commission.belongsTo(Case, { foreignKey: "case_id", as: "case" });

// ReportTemplate relationships
ReportTemplate.belongsTo(User, { foreignKey: "created_by", as: "creator" });
ReportTemplate.hasMany(GeneratedReport, {
  foreignKey: "template_id",
  as: "generatedReports",
});

// GeneratedReport relationships
GeneratedReport.belongsTo(Case, { foreignKey: "case_id", as: "case" });
GeneratedReport.belongsTo(ReportTemplate, {
  foreignKey: "template_id",
  as: "template",
});
GeneratedReport.belongsTo(User, {
  foreignKey: "generated_by",
  as: "generator",
});

// AuditLog relationships
AuditLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Export models
module.exports = {
  sequelize,
  User,
  Case,
  PatientDetail,
  HospitalDetail,
  PolicyDetail,
  BillDetail,
  DispatchDetail,
  CaseDocument,
  InvestigationNote,
  Commission,
  ReportTemplate,
  GeneratedReport,
  Company,
  License,
  AuditLog,
};
