/* =====================================================================
   demo-data.js — وضع العرض (Demo Mode)
   يُحاكي الـ backend كاملاً داخل المتصفّح بلا أي شبكة، بما في ذلك
   منطق معاملة الطلب الذرّية (ACID): فحص المخزون قبل خصمه، وإلغاء
   كامل عند نقص المخزون (لا يُخصم شيء ولا يُنشأ طلب).
   المصدر: database/04_seed.sql — كلمة المرور الموحّدة: Ashur@2026
   ===================================================================== */

(function (global) {
  'use strict';

  var DEMO_PASSWORD = 'Ashur@2026';

  /* ── الأدوار والصلاحيات (مطابقة لـ 02_rbac.sql) ── */
  var ROLE_PERMS = {
    admin:    ['products:read','products:create','products:update','products:delete','orders:read','orders:create','orders:update','customers:read','users:manage'],
    manager:  ['products:read','products:create','products:update','products:delete','orders:read','orders:create','orders:update','customers:read'],
    staff:    ['products:read','orders:read','orders:create','orders:update','customers:read'],
    customer: ['products:read','orders:create'],
  };

  /* ── المستخدمون ── */
  var USERS = [
    { id: 'u-1', username: 'admin',    email: 'admin@store.iq',    full_name: 'مدير النظام',    role: 'admin',    customer_id: null },
    { id: 'u-2', username: 'manager',  email: 'manager@store.iq',  full_name: 'مدير المتجر',    role: 'manager',  customer_id: null },
    { id: 'u-3', username: 'staff',    email: 'staff@store.iq',    full_name: 'موظّف المبيعات', role: 'staff',    customer_id: null },
    { id: 'u-4', username: 'customer', email: 'customer@store.iq', full_name: 'زبون تجريبي',    role: 'customer', customer_id: 'c-1' },
  ];

  /* ── التصنيفات ── */
  var CATEGORIES = [
    { id: 1, name: 'إلكترونيات', description: 'أجهزة وملحقات إلكترونية' },
    { id: 2, name: 'منزل ومطبخ', description: 'أدوات منزلية' },
    { id: 3, name: 'كتب',        description: 'كتب ومراجع' },
  ];

  /* ── المنتجات (حالة قابلة للتعديل أثناء الجلسة) ── */
  var PRODUCTS = [
    { id: 'p-1', sku: 'SKU-1001', name: 'سمّاعة بلوتوث',          category_id: 1, category_name: 'إلكترونيات', price: 35000, stock: 3,  is_active: true },
    { id: 'p-2', sku: 'SKU-1002', name: 'شاحن سريع 65 واط',       category_id: 1, category_name: 'إلكترونيات', price: 18000, stock: 50, is_active: true },
    { id: 'p-3', sku: 'SKU-1003', name: 'لوحة مفاتيح ميكانيكية',  category_id: 1, category_name: 'إلكترونيات', price: 60000, stock: 20, is_active: true },
    { id: 'p-4', sku: 'SKU-2001', name: 'غلّاية كهربائية',        category_id: 2, category_name: 'منزل ومطبخ', price: 25000, stock: 30, is_active: true },
    { id: 'p-5', sku: 'SKU-2002', name: 'طقم سكاكين',             category_id: 2, category_name: 'منزل ومطبخ', price: 40000, stock: 15, is_active: true },
    { id: 'p-6', sku: 'SKU-3001', name: 'كتاب: أساسيات الأمن السيبراني', category_id: 3, category_name: 'كتب', price: 15000, stock: 40, is_active: true },
    { id: 'p-7', sku: 'SKU-3002', name: 'كتاب: قواعد البيانات',   category_id: 3, category_name: 'كتب',        price: 20000, stock: 25, is_active: true },
  ];

  /* ── الزبائن ── */
  var CUSTOMERS = [
    { id: 'c-1', full_name: 'زبون تجريبي', email: 'customer@store.iq', phone: '07700000001', address: 'بغداد - الكرادة' },
    { id: 'c-2', full_name: 'حسن العامري',  email: 'hasan@mail.iq',     phone: '07700000002', address: 'البصرة - العشار' },
    { id: 'c-3', full_name: 'زينب الكاظمي', email: 'zainab@mail.iq',    phone: '07700000003', address: 'النجف - المركز' },
  ];

  /* ── الطلبات (تبدأ بطلب seed واحد) ── */
  var ORDERS = [];
  var ORDER_ITEMS = [];
  var PAYMENTS = [];
  var seq = 1;
  function nextId(prefix) { return prefix + '-' + (seq++); }

  /* طلب seed: زبون تجريبي اشترى شاحناً واحداً (يخصم المخزون) */
  (function seedOrder() {
    var p = PRODUCTS.find(x => x.sku === 'SKU-1002');
    p.stock -= 1;
    var oid = 'o-seed';
    ORDERS.push({ id: oid, customer_id: 'c-1', customer_name: 'زبون تجريبي', status: 'paid', total_amount: p.price, created_at: '2026-06-25T10:00:00Z' });
    ORDER_ITEMS.push({ order_id: oid, product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.price, line_total: p.price });
    PAYMENTS.push({ order_id: oid, amount: p.price, method: 'card', status: 'completed', paid_at: '2026-06-25T10:00:00Z' });
  })();

  /* ── أدوات الجلسة ── */
  function currentUser() {
    try { return JSON.parse(localStorage.getItem('shop_user')); } catch { return null; }
  }
  function can(code) {
    var u = currentUser();
    return !!(u && (ROLE_PERMS[u.role] || []).includes(code));
  }
  function err(message, status) { var e = new Error(message); e.status = status; throw e; }

  /* =====================================================================
     منطق معاملة ACID داخل المتصفّح — يحاكي place_order()
     يُحاكي السلوك الذرّي: نتحقّق أولاً من كل الأسطر (مخزون + وجود)،
     ولا نطبّق أي خصم إلا بعد نجاح كل الفحوص. هذا يكافئ ROLLBACK:
     فشل أي سطر يعني عدم تغيير أي مخزون وعدم إنشاء طلب.
     ===================================================================== */
  function placeOrder(customerId, items, method) {
    var cust = CUSTOMERS.find(c => c.id === customerId);
    if (!cust) err('الزبون غير موجود', 404);
    if (!Array.isArray(items) || items.length === 0) err('الطلب فارغ', 400);

    // مرحلة 1: التحقّق فقط (بلا أي تعديل) — جوهر الذرّية
    var resolved = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var qty = parseInt(it.quantity, 10);
      if (!qty || qty <= 0) err('كمية غير صالحة', 400);
      var prod = PRODUCTS.find(p => p.id === it.product_id && p.is_active);
      if (!prod) err('منتج غير موجود أو معطّل في الطلب', 404);
      if (prod.stock < qty) {
        // فشل → لا نطبّق أي شيء (ROLLBACK محاكى)
        err('المخزون غير كافٍ للمنتج "' + prod.name + '" (المتوفّر: ' + prod.stock + '، المطلوب: ' + qty + ')', 409);
      }
      resolved.push({ prod: prod, qty: qty });
    }

    // مرحلة 2: التطبيق (COMMIT محاكى) — نُنفّذ كل شيء معاً
    var total = 0;
    var oid = nextId('o');
    resolved.forEach(function (r) {
      r.prod.stock -= r.qty;             // خصم المخزون
      var lineTotal = r.prod.price * r.qty;
      total += lineTotal;
      ORDER_ITEMS.push({ order_id: oid, product_id: r.prod.id, product_name: r.prod.name, quantity: r.qty, unit_price: r.prod.price, line_total: lineTotal });
    });
    ORDERS.push({ id: oid, customer_id: customerId, customer_name: cust.full_name, status: 'paid', total_amount: total, created_at: new Date().toISOString() });
    PAYMENTS.push({ order_id: oid, amount: total, method: method || 'card', status: 'completed', paid_at: new Date().toISOString() });

    return { order_id: oid, status: 'paid', payment_method: method || 'card', total_amount: total };
  }

  /* =====================================================================
     موجّه الطلبات — يحاكي مسارات الـ API
     ===================================================================== */
  function handle(httpMethod, path, body) {
    return new Promise(function (resolve, reject) {
      // محاكاة تأخّر بسيط للواقعية
      setTimeout(function () {
        // مطابقة عقد الـbackend: النجاح يَحسم الوعد، والخطأ يرفضه برسالته وحالته
        // (err() داخل route تُطلق Error يحمل message+status). بدون هذا الالتقاط
        // يبقى الوعد معلّقاً عند أي خطأ (دخول خاطئ / نقص مخزون) فتتجمّد الواجهة.
        try { resolve(route(httpMethod, path, body)); }
        catch (e) { reject(e); }
      }, 120);
    });
  }

  function route(method, path, body) {
    var clean = path.split('?')[0];

    /* ── تسجيل الدخول ── */
    if (method === 'POST' && clean === '/auth/login') {
      var u = USERS.find(x => x.username === body.username);
      if (!u || body.password !== DEMO_PASSWORD) err('بيانات الدخول غير صحيحة', 401);
      var perms = ROLE_PERMS[u.role] || [];
      return { success: true, data: {
        access_token: 'demo-token.' + u.id, token_type: 'Bearer', expires_in: '2h',
        user: { id: u.id, username: u.username, email: u.email, full_name: u.full_name, role: u.role, customer_id: u.customer_id, permissions: perms },
      }};
    }

    if (method === 'GET' && clean === '/auth/me') {
      var me = currentUser();
      if (!me) err('غير مصادَق', 401);
      return { success: true, data: me };
    }

    /* ── المنتجات ── */
    if (method === 'GET' && clean === '/products') {
      if (!can('products:read')) err('صلاحيات غير كافية', 403);
      return { success: true, data: PRODUCTS.map(p => Object.assign({}, p)) };
    }
    if (method === 'POST' && clean === '/products') {
      if (!can('products:create')) err('صلاحيات غير كافية', 403);
      if (!body.sku || !body.name || body.price == null) err('بيانات ناقصة', 400);
      if (Number(body.price) < 0 || Number(body.stock || 0) < 0) err('قيم سالبة غير مسموحة', 400);
      var cat = CATEGORIES.find(c => c.id === Number(body.category_id));
      var np = { id: nextId('p'), sku: body.sku, name: body.name, price: Number(body.price), stock: Number(body.stock || 0), category_id: body.category_id || null, category_name: cat ? cat.name : null, is_active: true };
      PRODUCTS.unshift(np);
      return { success: true, data: np };
    }
    var prodMatch = clean.match(/^\/products\/([^/]+)$/);
    if (prodMatch) {
      var prod = PRODUCTS.find(p => p.id === prodMatch[1]);
      if (method === 'GET') { if (!can('products:read')) err('صلاحيات غير كافية', 403); if (!prod) err('المنتج غير موجود', 404); return { success: true, data: prod }; }
      if (method === 'PATCH') {
        if (!can('products:update')) err('صلاحيات غير كافية', 403);
        if (!prod) err('المنتج غير موجود', 404);
        if (body.stock != null && Number(body.stock) < 0) err('المخزون سالب', 400);
        if (body.price != null && Number(body.price) < 0) err('السعر سالب', 400);
        ['name','price','stock','is_active','description'].forEach(function (k) { if (body[k] != null) prod[k] = (k === 'price' || k === 'stock') ? Number(body[k]) : body[k]; });
        return { success: true, data: prod };
      }
      if (method === 'DELETE') {
        if (!can('products:delete')) err('صلاحيات غير كافية', 403);
        if (!prod) err('المنتج غير موجود', 404);
        prod.is_active = false;
        return { success: true, data: { id: prod.id, deactivated: true } };
      }
    }

    /* ── التصنيفات والزبائن ── */
    if (method === 'GET' && clean === '/categories') {
      if (!can('products:read')) err('صلاحيات غير كافية', 403);
      return { success: true, data: CATEGORIES };
    }
    if (method === 'GET' && clean === '/customers') {
      if (!can('customers:read')) err('صلاحيات غير كافية', 403);
      return { success: true, data: CUSTOMERS };
    }

    /* ── الطلبات ── */
    if (method === 'POST' && clean === '/orders') {
      if (!can('orders:create')) err('صلاحيات غير كافية', 403);
      var u2 = currentUser();
      var custId = body.customer_id || (u2 && u2.customer_id);
      if (!custId) err('customer_id مطلوب', 400);
      var result = placeOrder(custId, body.items, body.payment_method); // ← معاملة ACID محاكاة
      return { success: true, data: result };
    }
    if (method === 'GET' && clean === '/orders') {
      if (!can('orders:read')) err('صلاحيات غير كافية', 403);
      var list = ORDERS.map(function (o) {
        return Object.assign({}, o, { items_count: ORDER_ITEMS.filter(i => i.order_id === o.id).length });
      }).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { success: true, data: list };
    }
    var orderMatch = clean.match(/^\/orders\/([^/]+)$/);
    if (method === 'GET' && orderMatch) {
      if (!can('orders:read')) err('صلاحيات غير كافية', 403);
      var o = ORDERS.find(x => x.id === orderMatch[1]);
      if (!o) err('الطلب غير موجود', 404);
      return { success: true, data: Object.assign({}, o, {
        items: ORDER_ITEMS.filter(i => i.order_id === o.id),
        payment: PAYMENTS.find(p => p.order_id === o.id) || null,
      })};
    }
    var statusMatch = clean.match(/^\/orders\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      if (!can('orders:update')) err('صلاحيات غير كافية', 403);
      var o2 = ORDERS.find(x => x.id === statusMatch[1]);
      if (!o2) err('الطلب غير موجود', 404);
      if (['pending','paid','shipped','cancelled'].indexOf(body.status) < 0) err('حالة غير صالحة', 400);
      o2.status = body.status;
      return { success: true, data: { id: o2.id, status: o2.status } };
    }

    err('المسار غير موجود: ' + path, 404);
  }

  global.DEMO = { handle: handle };
})(window);
