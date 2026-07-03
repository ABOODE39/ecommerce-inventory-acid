'use strict';

// =====================================================================
//  RBAC Middleware — فحص الدور والصلاحية من req.user
//  يعمل بعد authenticate
// =====================================================================

const AppError = require('../utils/AppError');

/**
 * requireRole — يتحقق أن المستخدم يحمل أحد الأدوار المطلوبة (OR)
 * مثال: requireRole('admin', 'manager')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('غير مصادَق', 401, 'UNAUTHENTICATED'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(
        `هذه العملية تتطلب أحد الأدوار: ${roles.join(', ')}`,
        403, 'INSUFFICIENT_ROLE'
      ));
    }
    next();
  };
}

/**
 * requirePermission — يتحقق أن المستخدم يحمل الصلاحية المطلوبة
 * مثال: requirePermission('products:create')
 */
function requirePermission(code) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('غير مصادَق', 401, 'UNAUTHENTICATED'));
    const perms = req.user.permissions || [];
    if (!perms.includes(code)) {
      return next(new AppError(
        'صلاحيات غير كافية لهذه العملية',
        403, 'INSUFFICIENT_PERMISSIONS'
      ));
    }
    next();
  };
}

module.exports = { requireRole, requirePermission };
