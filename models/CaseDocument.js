const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaseDocument = sequelize.define('CaseDocument', {
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
    document_type: {
        type: DataTypes.ENUM(
            'patient_docs', 'hospital_records', 'policy_docs', 'bills', 'discharge_summary', 'id_proofs', 'other',
            'td_part', 'verification_part', 'hos_part', 'lab_part', 'medi_part', 'pt_part', 'other_merged'
        ),
        allowNull: false
    },
    doc_source: {
        type: DataTypes.ENUM('company', 'investigation'),
        defaultValue: 'investigation',
        allowNull: false
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    file_path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    uploaded_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'case_documents',
    timestamps: true
});

module.exports = CaseDocument;
