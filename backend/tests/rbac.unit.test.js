'use strict';

// =====================================================================
//  اختبارات وحدة لـ RBAC middleware — لا تحتاج قاعدة بيانات
// =====================================================================

const { requireRole, requirePermission } = require('../src/middleware/rbac');

/** أداة بناء req/res/next وهمية */
function mock(user) {
  const req = { user };
  const res = {};
  let nextErr;
  const next = (err) => { nextErr = err; };
  return { req, res, next, getErr: () => nextErr };
}

describe('requireRole', () => {
  test('يسمح للمستخدم بالدور المطلوب', () => {
    const m = mock({ role: 'admin' });
    requireRole('admin', 'manager')(m.req, m.res, m.next);
    expect(m.getErr()).toBeUndefined();
  });

  test('يرفض المستخدم بدور غير مسموح (403)', () => {
    const m = mock({ role: 'customer' });
    requireRole('admin')(m.req, m.res, m.next);
    expect(m.getErr()).toBeDefined();
    expect(m.getErr().statusCode).toBe(403);
    expect(m.getErr().code).toBe('INSUFFICIENT_ROLE');
  });

  test('يرفض غير المصادَق (401)', () => {
    const m = mock(undefined);
    requireRole('admin')(m.req, m.res, m.next);
    expect(m.getErr().statusCode).toBe(401);
  });
});

describe('requirePermission', () => {
  test('يسمح بوجود الصلاحية', () => {
    const m = mock({ permissions: ['products:create', 'orders:read'] });
    requirePermission('products:create')(m.req, m.res, m.next);
    expect(m.getErr()).toBeUndefined();
  });

  test('يرفض غياب الصلاحية (403)', () => {
    const m = mock({ permissions: ['products:read'] });
    requirePermission('products:create')(m.req, m.res, m.next);
    expect(m.getErr().statusCode).toBe(403);
    expect(m.getErr().code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  test('يرفض غياب مصفوفة الصلاحيات تماماً', () => {
    const m = mock({});
    requirePermission('orders:create')(m.req, m.res, m.next);
    expect(m.getErr().statusCode).toBe(403);
  });
});
