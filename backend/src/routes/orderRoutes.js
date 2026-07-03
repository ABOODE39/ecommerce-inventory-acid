'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// إنشاء طلب (معاملة ACID) — يتطلب orders:create
router.post('/', authenticate, requirePermission('orders:create'), ctrl.create);

// عرض الطلبات — يتطلب orders:read
router.get('/',    authenticate, requirePermission('orders:read'), ctrl.list);
router.get('/:id', authenticate, requirePermission('orders:read'), ctrl.getOne);

// تحديث حالة الطلب — يتطلب orders:update
router.patch('/:id/status', authenticate, requirePermission('orders:update'), ctrl.updateStatus);

module.exports = router;
