-- =====================================================================
--  02_rbac.sql — التحكّم في الوصول حسب الدور (RBAC مبسّط)
--  4 أدوار:  admin · manager · staff · customer
--  صلاحيات أساسية بصيغة  resource:action
-- =====================================================================
--  ملاحظة: هذا RBAC تطبيقي بسيط (تُفحص الصلاحيات في الـ backend).
--  لم نستخدم Row-Level Security المعقّد لإبقاء المشروع بسيطاً ومناسباً
--  لمشروع بكالوريوس.
-- =====================================================================

-- إسقاط آمن لإعادة التطبيق
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions      CASCADE;

-- =====================================================================
--  جدول الصلاحيات
-- =====================================================================
CREATE TABLE permissions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(60) NOT NULL UNIQUE,   -- products:read, orders:create ...
    description VARCHAR(150)
);

-- جدول الربط (دور ↔ صلاحية) — علاقة many-to-many
CREATE TABLE role_permissions (
    role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- =====================================================================
--  1) الأدوار الأربعة
-- =====================================================================
INSERT INTO roles (name, description) VALUES
    ('admin',    'مدير النظام — صلاحيات كاملة'),
    ('manager',  'مدير المتجر — إدارة المنتجات والطلبات والمخزون'),
    ('staff',    'موظّف — عرض المنتجات والطلبات وتحديث الحالة'),
    ('customer', 'زبون — تصفّح المنتجات وإنشاء الطلبات')
ON CONFLICT (name) DO NOTHING;

-- =====================================================================
--  2) الصلاحيات الأساسية
-- =====================================================================
INSERT INTO permissions (code, description) VALUES
    ('products:read',    'عرض المنتجات والمخزون'),
    ('products:create',  'إضافة منتج جديد'),
    ('products:update',  'تعديل منتج أو مخزونه'),
    ('products:delete',  'حذف/تعطيل منتج'),
    ('orders:read',      'عرض الطلبات'),
    ('orders:create',    'إنشاء طلب (معاملة ACID)'),
    ('orders:update',    'تحديث حالة الطلب'),
    ('customers:read',   'عرض الزبائن'),
    ('users:manage',     'إدارة المستخدمين والأدوار')
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
--  3) ربط الصلاحيات بالأدوار
-- =====================================================================

-- admin: كل الصلاحيات
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- manager: كل شيء عدا إدارة المستخدمين
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND p.code <> 'users:manage'
ON CONFLICT DO NOTHING;

-- staff: قراءة المنتجات/الطلبات/الزبائن + إنشاء وتحديث الطلبات
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'staff'
  AND p.code IN ('products:read','orders:read','orders:create','orders:update','customers:read')
ON CONFLICT DO NOTHING;

-- customer: قراءة المنتجات + إنشاء طلباته الخاصّة
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'customer'
  AND p.code IN ('products:read','orders:create')
ON CONFLICT DO NOTHING;

-- =====================================================================
--  عرض مساعد: جلب صلاحيات أي مستخدم بسهولة
-- =====================================================================
CREATE OR REPLACE VIEW user_permissions AS
SELECT u.id          AS user_id,
       u.username,
       r.name        AS role_name,
       p.code        AS permission_code
FROM users u
JOIN roles r            ON r.id = u.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p       ON p.id = rp.permission_id;
