const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PolicyDetail = sequelize.define(
  "PolicyDetail",
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
    insurance_company: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    policy_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    policy_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sum_insured: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    claim_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    claim_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    tpa_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    claim_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    date_of_visit: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    retail_or_corporate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "policy_details",
    timestamps: true,
  },
);

module.exports = PolicyDetail;
