const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DispatchDetail = sequelize.define('DispatchDetail', {
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
    hard_copy_submit_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    sender_name_address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    courier_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pod_number: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'dispatch_details',
    timestamps: true
});

module.exports = DispatchDetail;
