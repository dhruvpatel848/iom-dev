const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const License = sequelize.define(
  "License",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    machine_id: {
      type: DataTypes.STRING,
      allowNull: true, // Null initially, set upon activation
      defaultValue: null,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // False initially, True upon activation
    },
    client_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    activated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "licenses",
    timestamps: true,
  },
);

module.exports = License;
