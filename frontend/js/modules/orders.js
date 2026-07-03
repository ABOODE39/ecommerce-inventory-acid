/* =====================================================================
   modules/orders.js — وحدة الطلبات + إنشاء طلب (معاملة ACID)
   ===================================================================== */

(function (global) {
  'use strict';

  function fmt(n) { return Number(n || 0).toLocaleString('ar-IQ'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function icon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' +
      '<line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>';
  }

  var STATUS_BADGE = {
    pending:   '<span class="badge badge-amber">قيد الانتظار</span>',
    paid:      '<span class="badge badge-green">مدفوع</span>',
    shipped:   '<span class="badge badge-blue">مُرسل</span>',
    cancelled: '<span class="badge badge-red">ملغى</span>',
  };

  var STATUS_TEXT = { pending: 'قيد الانتظار', paid: 'مدفوع', shipped: 'مُرسل', cancelled: 'ملغى' };

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '">' +
      '<div class="empty-state"><div class="empty-icon">' + icon() + '</div>' +
      '<p>' + esc(text) + '</p></div></td></tr>';
  }
  function rowHtml(o, canUpdate) {
    return '<tr>' +
      '<td dir="ltr">' + esc(o.id) + '</td>' +
      '<td>' + esc(o.customer_name) + '</td>' +
      '<td>' + fmt(o.items_count) + '</td>' +
      '<td>' + fmt(o.total_amount) + '</td>' +
      '<td>' + (STATUS_BADGE[o.status] || o.status) + '</td>' +
      '<td dir="ltr">' + esc((o.created_at || '').slice(0, 10)) + '</td>' +
      '<td><button class="btn btn-ghost btn-sm view-order" data-id="' + o.id + '">عرض</button>' +
        (canUpdate && o.status === 'paid' ? ' <button class="btn btn-success btn-sm ship-order" data-id="' + o.id + '">شحن</button>' : '') +
      '</td></tr>';
  }

  async function render(container) {
    var canCreate = SHOP_Auth.hasPermission('orders:create');
    var canUpdate = SHOP_Auth.hasPermission('orders:update');
    var res = await apiGet('/orders');
    var orders = res.data || [];

    container.innerHTML =
      '<div class="section-head"><h3><span class="head-emoji" aria-hidden="true">🧾</span>الطلبات</h3>' +
        (canCreate ? '<button class="btn btn-primary btn-sm" id="new-order-btn">+ طلب جديد (معاملة ACID)</button>' : '') +
      '</div>' +
      '<div class="search-bar"><input type="text" id="order-search" class="form-control" placeholder="بحث برقم الطلب أو الزبون أو الحالة..."></div>' +
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>رقم الطلب</th><th>الزبون</th><th>عدد الأصناف</th><th>المجموع (د.ع)</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>' +
      '</tr></thead><tbody id="orders-tbody">' +
      (orders.length ? orders.map(function (o) { return rowHtml(o, canUpdate); }).join('') : emptyRow(7, 'لا توجد طلبات.')) +
      '</tbody></table></div>';

    function bindRowButtons() {
      container.querySelectorAll('.view-order').forEach(function (b) {
        b.addEventListener('click', function () { viewOrder(b.dataset.id); });
      });
      container.querySelectorAll('.ship-order').forEach(function (b) {
        b.addEventListener('click', async function () {
          await apiPatch('/orders/' + b.dataset.id + '/status', { status: 'shipped' });
          render(container);
        });
      });
    }

    function renderRows(list) {
      var tbody = document.getElementById('orders-tbody');
      if (!tbody) return;
      tbody.innerHTML = list.length
        ? list.map(function (o) { return rowHtml(o, canUpdate); }).join('')
        : emptyRow(7, 'لا توجد نتائج مطابقة.');
      bindRowButtons();
    }

    if (canCreate) {
      var nb = document.getElementById('new-order-btn');
      if (nb) nb.addEventListener('click', function () { openOrderModal(container); });
    }
    bindRowButtons();

    var searchInput = document.getElementById('order-search');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        var q = e.target.value.trim().toLowerCase();
        if (!q) { renderRows(orders); return; }
        renderRows(orders.filter(function (o) {
          return String(o.id || '').toLowerCase().includes(q) ||
                 String(o.customer_name || '').toLowerCase().includes(q) ||
                 String(STATUS_TEXT[o.status] || o.status || '').toLowerCase().includes(q);
        }));
      });
    }
  }

  async function openOrderModal(container) {
    var products = (await apiGet('/products')).data.filter(p => p.is_active);
    var customers = [];
    try { customers = (await apiGet('/customers')).data; } catch (e) { /* الزبون يطلب لنفسه */ }

    var prodOptions = products.map(p => '<option value="' + p.id + '" data-price="' + p.price + '">' + esc(p.name) + ' (مخزون: ' + p.stock + ')</option>').join('');

    var custBlock = customers.length
      ? '<div class="form-group"><label class="form-label">الزبون</label><select class="form-control" id="o-customer">' +
        customers.map(c => '<option value="' + c.id + '">' + esc(c.full_name) + '</option>').join('') + '</select></div>'
      : '';

    function lineHtml() {
      return '<div class="cart-line">' +
        '<select class="form-control line-product">' + prodOptions + '</select>' +
        '<input type="number" min="1" value="1" class="form-control line-qty">' +
        '<button type="button" class="btn btn-danger btn-sm remove-line">×</button></div>';
    }

    global.SHOP_Modal.open('إنشاء طلب جديد',
      custBlock +
      '<label class="form-label">الأصناف</label>' +
      '<div id="cart-lines">' + lineHtml() + '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm mt-1" id="add-line">+ صنف</button>' +
      '<div class="form-group mt-1"><label class="form-label">طريقة الدفع</label>' +
        '<select class="form-control" id="o-method"><option value="card">بطاقة</option><option value="cash">نقد</option><option value="transfer">تحويل</option></select></div>' +
      '<div id="order-msg"></div>',
      async function () {
        var lines = Array.from(document.querySelectorAll('.cart-line')).map(function (el) {
          return { product_id: el.querySelector('.line-product').value, quantity: Number(el.querySelector('.line-qty').value) };
        }).filter(l => l.quantity > 0);

        if (!lines.length) { alert('أضف صنفاً واحداً على الأقل'); return false; }

        var payload = { items: lines, payment_method: document.getElementById('o-method').value };
        var custSel = document.getElementById('o-customer');
        if (custSel) payload.customer_id = custSel.value;

        var msg = document.getElementById('order-msg');
        try {
          var r = await apiPost('/orders', payload);
          msg.innerHTML = '<div class="alert alert-success">تم إنشاء الطلب ' + esc(r.data.order_id) + ' بنجاح (خُصم المخزون داخل معاملة ذرّية).</div>';
          setTimeout(function () { render(container); }, 700);
          return true;
        } catch (e) {
          // فشل المعاملة → ROLLBACK: لم يُخصم مخزون ولم يُنشأ طلب
          msg.innerHTML = '<div class="alert alert-error">فشل الطلب (ROLLBACK كامل): ' + esc(e.message) + '</div>';
          return false; // أبقِ النافذة مفتوحة ليرى المستخدم الرسالة
        }
      }, 'تأكيد الطلب');

    document.getElementById('add-line').addEventListener('click', function () {
      document.getElementById('cart-lines').insertAdjacentHTML('beforeend', lineHtml());
      bindRemove();
    });
    bindRemove();
    function bindRemove() {
      document.querySelectorAll('.remove-line').forEach(function (b) {
        b.onclick = function () {
          if (document.querySelectorAll('.cart-line').length > 1) b.closest('.cart-line').remove();
        };
      });
    }
  }

  async function viewOrder(id) {
    var o = (await apiGet('/orders/' + id)).data;
    var itemsHtml = o.items.map(function (it) {
      return '<tr><td>' + esc(it.product_name) + '</td><td>' + fmt(it.quantity) + '</td><td>' + fmt(it.unit_price) + '</td><td>' + fmt(it.line_total) + '</td></tr>';
    }).join('');
    global.SHOP_Modal.open('تفاصيل الطلب ' + esc(o.id),
      '<p><strong>الزبون:</strong> ' + esc(o.customer_name) + '</p>' +
      '<p><strong>الحالة:</strong> ' + (STATUS_BADGE[o.status] || o.status) + '</p>' +
      '<div class="table-wrap mt-1"><table><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead><tbody>' +
        itemsHtml + '</tbody></table></div>' +
      '<p class="mt-1"><strong>الإجمالي:</strong> ' + fmt(o.total_amount) + ' د.ع</p>' +
      (o.payment ? '<p><strong>الدفع:</strong> ' + esc(o.payment.method) + ' — ' + esc(o.payment.status) + '</p>' : ''),
      null);
  }

  global.SHOP_Modules = global.SHOP_Modules || {};
  global.SHOP_Modules.orders = {
    id: 'orders', label: 'الطلبات', permission: 'orders:read', icon: '🧾', render: render,
  };
})(window);
