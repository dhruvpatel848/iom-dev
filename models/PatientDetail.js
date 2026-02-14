const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PatientDetail = sequelize.define(
  "PatientDetail",
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    gender: {
      type: DataTypes.ENUM("male", "female", "other"),
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    aadhaar_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mobile_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    insured_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    admission_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    discharge_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: "patient_details",
    timestamps: true,
  },
);

module.exports = PatientDetail;
