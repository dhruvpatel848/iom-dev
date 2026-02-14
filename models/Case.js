const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Case = sequelize.define(
  "Case",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    case_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    officer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    insurance_company: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("open", "in_progress", "closed"),
      allowNull: false,
      defaultValue: "open",
    },
    officer_id_2: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    field_officer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    qc_manager: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    case_remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "cases",
    timestamps: true,
  },
);

module.exports = Case;
