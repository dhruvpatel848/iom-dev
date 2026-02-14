const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HospitalDetail = sequelize.define(
  "HospitalDetail",
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
    hospital_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    registration_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    doctor_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bed_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    doctor_registration_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pathology_center: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pathology_doctor_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pathologist_registration_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    medical_store: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    total_beds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    accommodation_class: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Hospital Infrastructure
    icu_beds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ot_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rmo_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    nursing_staff_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Doctor Details
    doctor_qualification: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    doctor_contact: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Pharmacy Details
    pharmacy_dl_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pharmacy_gst_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "hospital_details",
    timestamps: true,
  },
);

module.exports = HospitalDetail;
