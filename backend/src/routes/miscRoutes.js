'use strict';

const express = require('express');
const router = express.Router();
const { listCategories, listCustomers } = require('../controllers/miscController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// التصنيفات متاحة لمن يملك products:read
router.get('/categories', authenticate, requirePermission('products:read'), listCategories);
// الزبائن لمن يملك customers:read
router.get('/customers',  authenticate, requirePermission('customers:read'), listCustomers);

module.exports = router;
