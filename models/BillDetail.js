const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BillDetail = sequelize.define('BillDetail', {
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
    gst_bill: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bill_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mrd_charge: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    approved_expense_company: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    approved_expense_fo: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    total_bill_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    payment_received_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    received_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    other_expenses: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'bill_details',
    timestamps: true
});

module.exports = BillDetail;
