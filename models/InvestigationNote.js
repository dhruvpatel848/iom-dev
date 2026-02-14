const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InvestigationNote = sequelize.define(
  "InvestigationNote",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    case_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "cases",
        key: "id",
      },
    },
    findings: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    red_flags: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    supporting_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trigger: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Separate Visit Findings
    hospital_visit_findings: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    doctor_visit_findings: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    insured_visit_findings: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pharmacy_visit_findings: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lab_visit_findings: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Case Summary
    brief_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    conclusion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "investigation_notes",
    timestamps: true,
  },
);

module.exports = InvestigationNote;
