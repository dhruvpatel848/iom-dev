const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { Case, BillDetail, User, sequelize } = require("../models");
const { Op } = require("sequelize");

// Field Officer Billing View (My Billing)
router.get("/my-billing", isAuthenticated, async (req, res) => {
    try {
        if (req.user.role !== "field_officer") {
            req.session.error = "Access denied.";
            return res.redirect("/");
        }

        const { month, year } = req.query;
        const where = {
            field_officer_id: req.user.id,
            status: { [Op.ne]: "closed" }, // Optional: only show active? Or all? User said "assigned cases".
        };

        // If strict billing per month is needed based on completion/submission, we need a date filter.
        // For now, listing all assigned cases with bills.

        const cases = await Case.findAll({
            where,
            include: [
                { model: BillDetail, as: "billDetail" },
                { model: User, as: "officer", attributes: ["name"] }
            ],
            order: [["createdAt", "DESC"]],
        });

        res.render("billing/index", {
            title: "My Billing",
            cases,
            month,
            year
        });
    } catch (error) {
        console.error("Error fetching billing:", error);
        req.session.error = "Error loading billing.";
        res.redirect("/cases/dashboard");
    }
});

// Admin Billing Report (Monthly FO Billing)
router.get("/reports", isAuthenticated, async (req, res) => {
    try {
        if (!["admin", "super_admin"].includes(req.user.role)) {
            req.session.error = "Access denied.";
            return res.redirect("/");
        }

        const { month, year, field_officer_id } = req.query;

        // Default to current month/year if not provided?
        // Or just list all? "superadmin can see fo billing per month" implies filtering.

        const currentYear = year || new Date().getFullYear();
        const currentMonth = month || (new Date().getMonth() + 1);

        const where = {};
        if (field_officer_id) where.field_officer_id = field_officer_id;

        // We need to filter by date. Which date? 'createdAt'? 'updatedAt'? 'billDetail.payment_received_date'?
        // Assuming Case Created Date for now, or we can filter by bill date if it exists.
        // Let's use Case Created Date as a proxy for "Assigned Month" unless specified otherwise.

        // where.createdAt = {
        //   [Op.gte]: new Date(currentYear, currentMonth - 1, 1),
        //   [Op.lt]: new Date(currentYear, currentMonth, 1),
        // };

        const cases = await Case.findAll({
            where: {
                ...where,
                field_officer_id: { [Op.ne]: null } // Only cases with FO
            },
            include: [
                { model: BillDetail, as: "billDetail" },
                { model: User, as: "fieldOfficer", attributes: ["name"] }
            ],
            order: [["field_officer_id", "ASC"], ["createdAt", "DESC"]]
        });

        // Aggregate data manually or via query
        const billingData = {};
        // Structure: { fo_name: { cases: [], total_amount: 0 } }

        cases.forEach(c => {
            if (!c.fieldOfficer) return;
            const foName = c.fieldOfficer.name;
            if (!billingData[foName]) {
                billingData[foName] = {
                    id: c.field_officer_id,
                    name: foName,
                    cases: [],
                    total_approved_fo: 0
                };
            }

            const amount = c.billDetail?.approved_expense_fo ? parseFloat(c.billDetail.approved_expense_fo) : 0;
            billingData[foName].cases.push({
                case_id: c.case_id,
                amount: amount,
                date: c.createdAt
            });
            billingData[foName].total_approved_fo += amount;
        });

        const fieldOfficers = await User.findAll({ where: { role: 'field_officer' } });

        res.render("billing/admin", {
            title: "FO Billing Reports",
            billingData,
            fieldOfficers,
            filters: { month: currentMonth, year: currentYear, field_officer_id }
        });

    } catch (error) {
        console.error("Error fetching billing reports:", error);
        req.session.error = "Error loading reports.";
        res.redirect("/admin/dashboard");
    }
});

module.exports = router;
