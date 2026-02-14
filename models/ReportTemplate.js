const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReportTemplate = sequelize.define('ReportTemplate', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    insurance_company: {
        type: DataTypes.STRING,
        allowNull: false
    },
    template_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    template_content: {
        type: DataTypes.TEXT('long'),
        allowNull: true // Changed to true to allow file-only templates
    },
    file_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'report_templates',
    timestamps: true
});

module.exports = ReportTemplate;
