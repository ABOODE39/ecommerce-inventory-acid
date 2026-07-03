'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// القراءة متاحة لكل من يملك products:read
router.get('/',    authenticate, requirePermission('products:read'), ctrl.list);
router.get('/:id', authenticate, requirePermission('products:read'), ctrl.getOne);

// الكتابة تتطلب صلاحيات أعلى (admin/manager)
router.post('/',      authenticate, requirePermission('products:create'), ctrl.create);
router.patch('/:id',  authenticate, requirePermission('products:update'), ctrl.update);
router.delete('/:id', authenticate, requirePermission('products:delete'), ctrl.remove);

module.exports = router;
