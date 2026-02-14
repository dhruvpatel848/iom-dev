const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GeneratedReport = sequelize.define('GeneratedReport', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    case_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'cases',
            key: 'id'
        }
    },
    template_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'report_templates',
            key: 'id'
        }
    },
    file_path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    generated_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    conclusion: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    recommendation: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'generated_reports',
    timestamps: true
});

module.exports = GeneratedReport;
