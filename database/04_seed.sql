-- =====================================================================
--  04_seed.sql — بيانات تجريبية (Seed)
--  كلمة المرور الموحّدة لكل الحسابات: Ashur@2026
--  (bcrypt hash واحد صالح للجميع — لأغراض العرض فقط)
-- =====================================================================

-- تنظيف البيانات (بالترتيب العكسي للاعتماديات) لإعادة التطبيق
TRUNCATE payments, order_items, orders, customers, products, categories, users
    RESTART IDENTITY CASCADE;

-- =====================================================================
--  المستخدمون — 4 حسابات تغطّي الأدوار الأربعة
--  hash يقابل كلمة المرور: Ashur@2026
-- =====================================================================
INSERT INTO users (username, email, password_hash, full_name, role_id) VALUES
    ('admin',    'admin@store.iq',    '$2a$10$NE7UEHpICyQusIgkvQsxcu.fj4Q4nYFDBXmkcKzwnVstH9tmUn5Hi', 'مدير النظام',     (SELECT id FROM roles WHERE name='admin')),
    ('manager',  'manager@store.iq',  '$2a$10$NE7UEHpICyQusIgkvQsxcu.fj4Q4nYFDBXmkcKzwnVstH9tmUn5Hi', 'مدير المتجر',     (SELECT id FROM roles WHERE name='manager')),
    ('staff',    'staff@store.iq',    '$2a$10$NE7UEHpICyQusIgkvQsxcu.fj4Q4nYFDBXmkcKzwnVstH9tmUn5Hi', 'موظّف المبيعات',  (SELECT id FROM roles WHERE name='staff')),
    ('customer', 'customer@store.iq', '$2a$10$NE7UEHpICyQusIgkvQsxcu.fj4Q4nYFDBXmkcKzwnVstH9tmUn5Hi', 'زبون تجريبي',     (SELECT id FROM roles WHERE name='customer'));

-- =====================================================================
--  التصنيفات
-- =====================================================================
INSERT INTO categories (name, description) VALUES
    ('إلكترونيات',  'أجهزة وملحقات إلكترونية'),
    ('منزل ومطبخ',  'أدوات منزلية ومستلزمات المطبخ'),
    ('كتب',         'كتب ورقية ومراجع');

-- =====================================================================
--  المنتجات — مع مخزون أوّلي
--  ملاحظة: "سمّاعة بلوتوث" مخزونها 3 فقط — مفيد لاختبار نقص المخزون
-- =====================================================================
INSERT INTO products (sku, name, description, category_id, price, stock) VALUES
    ('SKU-1001', 'سمّاعة بلوتوث',      'سمّاعة لاسلكية عالية الجودة',       (SELECT id FROM categories WHERE name='إلكترونيات'),  35000.00,  3),
    ('SKU-1002', 'شاحن سريع 65 واط',   'شاحن USB-C بمنفذين',               (SELECT id FROM categories WHERE name='إلكترونيات'),  18000.00, 50),
    ('SKU-1003', 'لوحة مفاتيح ميكانيكية','لوحة مفاتيح للألعاب بإضاءة RGB',  (SELECT id FROM categories WHERE name='إلكترونيات'),  60000.00, 20),
    ('SKU-2001', 'غلّاية كهربائية',     'غلّاية ستانلس ستيل سعة 1.7 لتر',  (SELECT id FROM categories WHERE name='منزل ومطبخ'),  25000.00, 30),
    ('SKU-2002', 'طقم سكاكين',          'طقم 6 سكاكين مع حامل خشبي',        (SELECT id FROM categories WHERE name='منزل ومطبخ'),  40000.00, 15),
    ('SKU-3001', 'كتاب: أساسيات الأمن السيبراني', 'مرجع تعليمي عربي',       (SELECT id FROM categories WHERE name='كتب'),         15000.00, 40),
    ('SKU-3002', 'كتاب: قواعد البيانات', 'مدخل إلى أنظمة قواعد البيانات',   (SELECT id FROM categories WHERE name='كتب'),         20000.00, 25);

-- =====================================================================
--  الزبائن — أحدهم مرتبط بحساب الدخول customer
-- =====================================================================
INSERT INTO customers (user_id, full_name, email, phone, address) VALUES
    ((SELECT id FROM users WHERE username='customer'), 'زبون تجريبي', 'customer@store.iq', '07700000001', 'بغداد - الكرادة'),
    (NULL, 'حسن العامري',   'hasan@mail.iq',  '07700000002', 'البصرة - العشار'),
    (NULL, 'زينب الكاظمي',  'zainab@mail.iq', '07700000003', 'النجف - المركز');

-- =====================================================================
--  طلب تجريبي واحد عبر دالة ACID — يُثبت أن الدالة تعمل وتخصم المخزون
--  (زبون تجريبي يشتري شاحناً واحداً)
-- =====================================================================
DO $$
DECLARE
    v_cust  UUID;
    v_prod  UUID;
    v_order UUID;
BEGIN
    SELECT id INTO v_cust FROM customers WHERE email = 'customer@store.iq';
    SELECT id INTO v_prod FROM products  WHERE sku   = 'SKU-1002';

    v_order := place_order(
        v_cust,
        jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)),
        'card'
    );

    RAISE NOTICE 'تم إنشاء طلب تجريبي عبر place_order: %', v_order;
END $$;
