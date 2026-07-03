'use strict';

// =====================================================================
//  orderController — إنشاء الطلبات (معاملة ACID) وعرضها
// =====================================================================
//  نقطة create هي قلب المشروع: تستدعي دالة place_order داخل معاملة
//  pg واحدة (withTransaction). كل خطوات إنشاء الطلب — فحص المخزون،
//  خصمه، إنشاء الطلب وأسطره والدفعة — تحدث ذرّياً. عند نقص المخزون
//  تُرفع EXCEPTION من قاعدة البيانات فيُنفَّذ ROLLBACK كامل: لا يُنشأ
//  طلب ولا يُخصم مخزون (Atomicity + Consistency).
// =====================================================================

const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError     = require('../utils/AppError');

// ---- POST /api/v1/orders ----
const create = asyncHandler(async (req, res) => {
  let { customer_id, items, payment_method } = req.body;

  // الزبون: من الجسم، أو من توكن المستخدم إن كان دوره customer
  if (!customer_id && req.user.customer_id) {
    customer_id = req.user.customer_id;
  }
  if (!customer_id) {
    throw new AppError('customer_id مطلوب', 400, 'VALIDATION_ERROR');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items مطلوبة وغير فارغة', 400, 'VALIDATION_ERROR');
  }

  const method = payment_method || 'card';

  try {
    // ── المعاملة الذرّية (ACID) ──────────────────────────────────
    const orderId = await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT place_order($1, $2::jsonb, $3) AS order_id`,
        [customer_id, JSON.stringify(items), method]
      );
      return r.rows[0].order_id;
    });
    // إن وصلنا هنا فقد نجحت المعاملة وحدث COMMIT (Durability)

    res.status(201).json({
      success: true,
      data: { order_id: orderId, status: 'paid', payment_method: method },
    });
  } catch (err) {
    // ترجمة استثناءات place_order إلى أخطاء HTTP واضحة
    const msg = err.message || '';
    if (msg.includes('INSUFFICIENT_STOCK')) {
      throw new AppError(msg.replace(/^.*INSUFFICIENT_STOCK:\s*/, ''), 409, 'INSUFFICIENT_STOCK');
    }
    if (msg.includes('PRODUCT_NOT_FOUND')) {
      throw new AppError('منتج غير موجود أو معطّل في الطلب', 404, 'PRODUCT_NOT_FOUND');
    }
    if (msg.includes('CUSTOMER_NOT_FOUND')) {
      throw new AppError('الزبون غير موجود', 404, 'CUSTOMER_NOT_FOUND');
    }
    if (msg.includes('EMPTY_ORDER') || msg.includes('INVALID_QUANTITY')) {
      throw new AppError('بيانات الطلب غير صالحة', 400, 'VALIDATION_ERROR');
    }
    throw err; // أي خطأ آخر يذهب للمعالج المركزي (500)
  }
});

// ---- GET /api/v1/orders ----
const list = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.id, o.status, o.total_amount, o.created_at,
            c.full_name AS customer_name,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC`
  );
  res.json({ success: true, data: result.rows });
});

// ---- GET /api/v1/orders/:id ----
const getOne = asyncHandler(async (req, res) => {
  const head = await query(
    `SELECT o.id, o.status, o.total_amount, o.created_at,
            c.full_name AS customer_name, c.email AS customer_email
       FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1`,
    [req.params.id]
  );
  if (!head.rows[0]) throw new AppError('الطلب غير موجود', 404, 'ORDER_NOT_FOUND');

  const items = await query(
    `SELECT oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.line_total
       FROM order_items oi JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1`,
    [req.params.id]
  );

  const payment = await query(
    `SELECT amount, method, status, paid_at FROM payments WHERE order_id = $1`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: { ...head.rows[0], items: items.rows, payment: payment.rows[0] || null },
  });
});

// ---- PATCH /api/v1/orders/:id/status ----
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'paid', 'shipped', 'cancelled'];
  if (!allowed.includes(status)) {
    throw new AppError(`الحالة يجب أن تكون إحدى: ${allowed.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  // الإلغاء ليس مجرّد تغيير حالة: هو معاملة ذرّية تُعيد المخزون المخصوم
  // (عكس place_order) عبر cancel_order، وهي idempotent (لا تُعيد مرّتين).
  if (status === 'cancelled') {
    try {
      const row = await withTransaction(async (client) => {
        await client.query('SELECT cancel_order($1)', [req.params.id]);
        const r = await client.query('SELECT id, status FROM orders WHERE id = $1', [req.params.id]);
        return r.rows[0];
      });
      return res.json({ success: true, data: row });
    } catch (err) {
      if ((err.message || '').includes('ORDER_NOT_FOUND')) {
        throw new AppError('الطلب غير موجود', 404, 'ORDER_NOT_FOUND');
      }
      throw err;
    }
  }

  // للحالات الأخرى: منع تغيير طلب مُلغى (حالة نهائية تحفظ اتساق المخزون)
  const cur = await query(`SELECT status FROM orders WHERE id = $1`, [req.params.id]);
  if (!cur.rows[0]) throw new AppError('الطلب غير موجود', 404, 'ORDER_NOT_FOUND');
  if (cur.rows[0].status === 'cancelled') {
    throw new AppError('لا يمكن تغيير حالة طلب مُلغى', 409, 'INVALID_TRANSITION');
  }

  const result = await query(
    `UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status`,
    [status, req.params.id]
  );
  res.json({ success: true, data: result.rows[0] });
});

module.exports = { create, list, getOne, updateStatus };
