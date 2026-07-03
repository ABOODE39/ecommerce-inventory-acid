-- =====================================================================
--  01_schema.sql — مخطّط قاعدة بيانات المتجر الإلكتروني
--  نظام: إدارة المخزون والطلبات بمعاملة ذرّية (ACID)
--  جامعة آشور — قسم هندسة الأمن السيبراني — المرحلة الثانية
--  المكدّس: PostgreSQL 16
-- =====================================================================
--  الجداول (8): roles, users, categories, products, customers,
--               orders, order_items, payments
-- =====================================================================

-- pgcrypto يوفّر gen_random_uuid() لتوليد المعرّفات
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- إسقاط آمن لإعادة التطبيق (بالترتيب العكسي للاعتماديات)
DROP TABLE IF EXISTS payments      CASCADE;
DROP TABLE IF EXISTS order_items   CASCADE;
DROP TABLE IF EXISTS orders        CASCADE;
DROP TABLE IF EXISTS customers     CASCADE;
DROP TABLE IF EXISTS products      CASCADE;
DROP TABLE IF EXISTS categories    CASCADE;
DROP TABLE IF EXISTS users         CASCADE;
DROP TABLE IF EXISTS roles         CASCADE;

-- =====================================================================
--  1) roles — أدوار النظام (RBAC)
-- =====================================================================
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(40)  NOT NULL UNIQUE,   -- admin | manager | staff | customer
    description VARCHAR(200),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================================
--  2) users — حسابات الدخول (موظّفو المتجر + الزبائن)
--  password_hash يُخزَّن مشفّراً بـ bcrypt — لا تُخزَّن الكلمة خاماً
-- =====================================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(60)  NOT NULL UNIQUE,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(120) NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    role_id       INT NOT NULL REFERENCES roles(id),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role_id);

-- =====================================================================
--  3) categories — تصنيفات المنتجات
-- =====================================================================
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
--  4) products — المنتجات مع المخزون
--  stock: الكمية المتوفّرة — CHECK يمنع القيم السالبة (سلامة ACID)
--  price: السعر — CHECK يمنع الأسعار السالبة
-- =====================================================================
CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku         VARCHAR(40)  NOT NULL UNIQUE,        -- رمز المنتج
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    category_id INT REFERENCES categories(id),
    price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),  -- ضمان عدم السلب
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active   ON products(is_active);

-- =====================================================================
--  5) customers — بيانات الزبائن (قد يرتبط الزبون بحساب user)
-- =====================================================================
CREATE TABLE customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID UNIQUE REFERENCES users(id), -- اختياري: ربط 1:1 بحساب دخول (UNIQUE يسمح بعدّة NULL)
    full_name  VARCHAR(120) NOT NULL,
    email      VARCHAR(120) NOT NULL UNIQUE,
    phone      VARCHAR(30),
    address    VARCHAR(250),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================================
--  6) orders — رأس الطلب
--  status: pending → paid → shipped → cancelled
--  total_amount: مجموع الطلب — يُحسب داخل معاملة ACID
-- =====================================================================
CREATE TABLE orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID NOT NULL REFERENCES customers(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','shipped','cancelled')),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status   ON orders(status);

-- =====================================================================
--  7) order_items — أسطر الطلب (منتج + كمية + سعر لحظة الشراء)
--  ON DELETE CASCADE: حذف الطلب يحذف أسطره
--  unit_price يُجمَّد وقت الشراء حتى لو تغيّر سعر المنتج لاحقاً
-- =====================================================================
CREATE TABLE order_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity   INT  NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- =====================================================================
--  8) payments — دفعات الطلب
--  تُنشأ داخل نفس معاملة الطلب الذرّية (ACID)
-- =====================================================================
CREATE TABLE payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    method      VARCHAR(20) NOT NULL DEFAULT 'card'
                CHECK (method IN ('card','cash','transfer')),
    status      VARCHAR(20) NOT NULL DEFAULT 'completed'
                CHECK (status IN ('pending','completed','failed')),
    paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);

-- =====================================================================
--  دالة مساعدة: تحديث updated_at تلقائياً عند تعديل منتج
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
