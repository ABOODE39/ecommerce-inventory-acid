'use strict';

// =====================================================================
//  اختبارات تكامل — معاملة الطلب الذرّية (ACID) عبر HTTP + PostgreSQL
//  تتطلب قاعدة بيانات حيّة (DATABASE_URL). تُشغَّل في CI مع postgres:16.
//  محلياً: نفّذ ملفات database/*.sql أولاً، ثم npm test.
// =====================================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-secret-ecommerce-32chars!!';

const request = require('supertest');
const app = require('../src/app');
const { pool, query } = require('../src/config/db');

let adminToken, customerToken;
let chargerId, headsetId, customerId;

/** تسجيل دخول وإرجاع التوكن */
async function login(username, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  return res.body?.data?.access_token;
}

beforeAll(async () => {
  adminToken    = await login('admin', 'Ashur@2026');
  customerToken = await login('customer', 'Ashur@2026');

  // جلب معرّفات منتجات الـ seed والزبون
  const charger = await query(`SELECT id FROM products WHERE sku = 'SKU-1002'`);
  const headset = await query(`SELECT id, stock FROM products WHERE sku = 'SKU-1001'`);
  const cust    = await query(`SELECT id FROM customers WHERE email = 'customer@store.iq'`);
  chargerId  = charger.rows[0].id;
  headsetId  = headset.rows[0].id;
  customerId = cust.rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe('المصادقة', () => {
  test('تسجيل دخول admin ينجح ويُصدر توكناً', () => {
    expect(typeof adminToken).toBe('string');
    expect(adminToken.length).toBeGreaterThan(20);
  });

  test('تسجيل دخول ببيانات خاطئة يفشل (401)', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('المنتجات + RBAC', () => {
  test('قراءة المنتجات متاحة للزبون', async () => {
    const res = await request(app).get('/api/v1/products')
      .set('Authorization', 'Bearer ' + customerToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('إنشاء منتج ممنوع على الزبون (403)', async () => {
    const res = await request(app).post('/api/v1/products')
      .set('Authorization', 'Bearer ' + customerToken)
      .send({ sku: 'X', name: 'منتج', price: 1000 });
    expect(res.status).toBe(403);
  });

  test('إنشاء منتج مسموح للأدمن (201)', async () => {
    const sku = 'SKU-TEST-' + Date.now();
    const res = await request(app).post('/api/v1/products')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ sku, name: 'منتج اختبار', price: 5000, stock: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBe(sku);
  });

  test('رفض الطلب بلا توكن (401)', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(401);
  });
});

describe('معاملة الطلب الذرّية (ACID)', () => {
  test('طلب ناجح يَخصم المخزون ويُنشئ الطلب والدفعة', async () => {
    const before = await query('SELECT stock FROM products WHERE id = $1', [chargerId]);
    const stockBefore = before.rows[0].stock;

    const res = await request(app).post('/api/v1/orders')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ customer_id: customerId, items: [{ product_id: chargerId, quantity: 2 }], payment_method: 'card' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('paid');

    // المخزون نقص 2 (Consistency)
    const after = await query('SELECT stock FROM products WHERE id = $1', [chargerId]);
    expect(after.rows[0].stock).toBe(stockBefore - 2);

    // دفعة أُنشئت ضمن نفس المعاملة (Atomicity)
    const pay = await query('SELECT * FROM payments WHERE order_id = $1', [res.body.data.order_id]);
    expect(pay.rows.length).toBe(1);
    expect(Number(pay.rows[0].amount)).toBeGreaterThan(0);
  });

  test('ROLLBACK عند نقص المخزون: لا يُخصم ولا يُنشأ طلب', async () => {
    const before = await query('SELECT stock FROM products WHERE id = $1', [headsetId]);
    const stockBefore = before.rows[0].stock; // مخزون السمّاعة قليل (3 في الـ seed)
    const ordersBefore = await query('SELECT COUNT(*)::int AS n FROM orders');

    // اطلب أكثر من المتوفّر بكثير
    const res = await request(app).post('/api/v1/orders')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ customer_id: customerId, items: [{ product_id: headsetId, quantity: stockBefore + 100 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

    // المخزون لم يتغيّر إطلاقاً (Atomicity + Consistency)
    const after = await query('SELECT stock FROM products WHERE id = $1', [headsetId]);
    expect(after.rows[0].stock).toBe(stockBefore);

    // لم يُنشأ أي طلب جديد
    const ordersAfter = await query('SELECT COUNT(*)::int AS n FROM orders');
    expect(ordersAfter.rows[0].n).toBe(ordersBefore.rows[0].n);
  });

  test('ROLLBACK ذرّي لطلب متعدّد الأسطر: نجاح أول سطر لا يبقى إن فشل الثاني', async () => {
    const before = await query('SELECT stock FROM products WHERE id = $1', [chargerId]);
    const chargerStock = before.rows[0].stock;

    // السطر الأول صالح (شاحن)، الثاني يفشل (سمّاعة بكمية ضخمة)
    const res = await request(app).post('/api/v1/orders')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ customer_id: customerId, items: [
        { product_id: chargerId, quantity: 1 },
        { product_id: headsetId, quantity: 99999 },
      ]});

    expect(res.status).toBe(409);

    // مخزون الشاحن لم يُخصم رغم أن سطره كان صالحاً (Atomicity)
    const after = await query('SELECT stock FROM products WHERE id = $1', [chargerId]);
    expect(after.rows[0].stock).toBe(chargerStock);
  });

  test('طلب بمنتج غير موجود يُرجع 404', async () => {
    const res = await request(app).post('/api/v1/orders')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ customer_id: customerId, items: [
        { product_id: '00000000-0000-0000-0000-000000000000', quantity: 1 },
      ]});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('طلب فارغ يُرجع 400', async () => {
    const res = await request(app).post('/api/v1/orders')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ customer_id: customerId, items: [] });
    expect(res.status).toBe(400);
  });

  test('عرض تفاصيل طلب يتضمّن الأسطر والدفعة', async () => {
    const created = await request(app).post('/api/v1/orders')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ customer_id: customerId, items: [{ product_id: chargerId, quantity: 1 }] });
    const id = created.body.data.order_id;

    const res = await request(app).get('/api/v1/orders/' + id)
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.payment).not.toBeNull();
  });
});
