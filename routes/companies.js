const express = require('express');
const router = express.Router();
const { Company } = require('../models');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// List all companies
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const companies = await Company.findAll({ order: [['name', 'ASC']] });
        res.render('admin/companies/index', {
            title: 'Manage Insurance Companies',
            companies,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).render('error', { message: 'Error fetching companies' });
    }
});

// Create new company
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            req.flash('error', 'Company name is required');
            return res.redirect('/admin/companies');
        }
        await Company.create({ name });
        req.flash('success', 'Company added successfully');
        res.redirect('/admin/companies');
    } catch (error) {
        console.error('Error creating company:', error);
        req.flash('error', 'Error creating company (Name might be duplicate)');
        res.redirect('/admin/companies');
    }
});

// Toggle active status
router.post('/:id/toggle', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            req.flash('error', 'Company not found');
            return res.redirect('/admin/companies');
        }
        company.active = !company.active;
        await company.save();
        req.flash('success', 'Company status updated');
        res.redirect('/admin/companies');
    } catch (error) {
        console.error('Error updating company:', error);
        req.flash('error', 'Error updating company status');
        res.redirect('/admin/companies');
    }
});

module.exports = router;
