-- =====================================================================
--  03_acid_order.sql — الميزة المحورية: معاملة الطلب الذرّية (ACID)
-- =====================================================================
--  الدالة place_order() تُنفّذ منطق إنشاء الطلب بالكامل داخل معاملة
--  واحدة (PL/pgSQL تعمل ضمن معاملة ضمنية): تتحقّق من المخزون، تخصمه،
--  تُنشئ الطلب وأسطره والدفعة — كلّها معاً. أي فشل (مخزون غير كافٍ،
--  منتج غير موجود) يرفع استثناءً يُلغي كل التغييرات (ROLLBACK تلقائي).
-- =====================================================================
--  خصائص ACID الأربع وكيف تتحقّق هنا:
--
--  A — Atomicity (الذرّية):
--      كل العمليات (خصم المخزون + إدراج الطلب + الأسطر + الدفعة) تحدث
--      كوحدة واحدة لا تتجزّأ. إن فشل أي سطر يرفع RAISE EXCEPTION، فيُلغى
--      كل ما سبقه. لا يبقى طلب نصفه منفَّذ أبداً.
--
--  C — Consistency (الاتساق):
--      قيود قاعدة البيانات (CHECK stock >= 0، المفاتيح الأجنبية،
--      CHECK quantity > 0) تضمن أن القاعدة تنتقل من حالة صحيحة إلى أخرى
--      صحيحة. لا يمكن أن يصبح المخزون سالباً ولا أن يشير طلب لزبون وهمي.
--
--  I — Isolation (العزل):
--      SELECT ... FOR UPDATE يقفل صفّ المنتج طوال المعاملة، فيمنع طلبين
--      متزامنين من خصم نفس القطعة الأخيرة (يمنع race condition / oversell).
--
--  D — Durability (الديمومة):
--      بعد COMMIT (الذي تتولّاه طبقة الـ backend عبر pg) تُكتب التغييرات
--      إلى WAL على القرص وتبقى حتى لو انهار الخادم مباشرةً بعدها.
-- =====================================================================

DROP FUNCTION IF EXISTS place_order(UUID, JSONB, VARCHAR);

-- ---------------------------------------------------------------------
--  place_order
--  المدخلات:
--    p_customer_id   — معرّف الزبون
--    p_items         — JSONB مصفوفة: [{ "product_id": "...", "quantity": N }, ...]
--    p_payment_method— card | cash | transfer
--  المخرجات: order_id الطلب المُنشأ
--  السلوك: يرفع EXCEPTION عند نقص المخزون أو منتج غير موجود (→ ROLLBACK)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION place_order(
    p_customer_id    UUID,
    p_items          JSONB,
    p_payment_method VARCHAR DEFAULT 'card'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id    UUID;
    v_total       NUMERIC(12,2) := 0;
    v_item        JSONB;
    v_product_id  UUID;
    v_quantity    INT;
    v_price       NUMERIC(12,2);
    v_stock       INT;
    v_name        TEXT;
BEGIN
    -- التحقّق من وجود الزبون (Consistency)
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: الزبون % غير موجود', p_customer_id;
    END IF;

    -- التحقّق من وجود أسطر في الطلب
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_ORDER: الطلب لا يحتوي على أي عنصر';
    END IF;

    -- 1) إنشاء رأس الطلب (المجموع 0 مؤقتاً ويُحدَّث لاحقاً)
    INSERT INTO orders (customer_id, status, total_amount)
    VALUES (p_customer_id, 'pending', 0)
    RETURNING id INTO v_order_id;

    -- 2) المرور على كل عنصر: قفل المنتج، فحص المخزون، خصمه، إدراج السطر
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity   := (v_item->>'quantity')::INT;

        IF v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: كمية غير صالحة للمنتج %', v_product_id;
        END IF;

        -- Isolation: FOR UPDATE يقفل صفّ المنتج حتى نهاية المعاملة
        SELECT price, stock, name
          INTO v_price, v_stock, v_name
          FROM products
         WHERE id = v_product_id AND is_active = TRUE
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: المنتج % غير موجود أو معطّل', v_product_id;
        END IF;

        -- فحص كفاية المخزون — الشرط الجوهري لـ ROLLBACK
        IF v_stock < v_quantity THEN
            RAISE EXCEPTION
              'INSUFFICIENT_STOCK: المخزون غير كافٍ للمنتج "%" (المتوفّر: %، المطلوب: %)',
              v_name, v_stock, v_quantity;
        END IF;

        -- خصم المخزون (CHECK stock >= 0 يحرس الاتساق)
        UPDATE products
           SET stock = stock - v_quantity
         WHERE id = v_product_id;

        -- إدراج سطر الطلب بسعر اللحظة
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
        VALUES (v_order_id, v_product_id, v_quantity, v_price, v_price * v_quantity);

        v_total := v_total + (v_price * v_quantity);
    END LOOP;

    -- 3) تحديث مجموع الطلب وحالته إلى "مدفوع"
    UPDATE orders
       SET total_amount = v_total,
           status       = 'paid'
     WHERE id = v_order_id;

    -- 4) إنشاء الدفعة بنفس المبلغ — جزء من نفس المعاملة الذرّية
    INSERT INTO payments (order_id, amount, method, status)
    VALUES (v_order_id, v_total, p_payment_method, 'completed');

    -- إن وصلنا هنا فكل شيء نجح؛ الـ COMMIT يحدث في طبقة الاستدعاء
    RETURN v_order_id;

    -- أي EXCEPTION أعلاه يُنهي الدالة ويُلغي كل التغييرات (Atomicity)
END;
$$;

COMMENT ON FUNCTION place_order(UUID, JSONB, VARCHAR) IS
  'معاملة طلب ذرّية (ACID): فحص المخزون + خصمه + إنشاء الطلب وأسطره والدفعة معاً. تُلغى بالكامل عند أي فشل.';
