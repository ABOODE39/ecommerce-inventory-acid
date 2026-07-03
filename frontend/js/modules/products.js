/* =====================================================================
   modules/products.js — وحدة المنتجات والمخزون
   ===================================================================== */

(function (global) {
  'use strict';

  function fmt(n) { return Number(n).toLocaleString('ar-IQ'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function icon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
      '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
  }
  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '">' +
      '<div class="empty-state"><div class="empty-icon">' + icon() + '</div>' +
      '<p>' + esc(text) + '</p></div></td></tr>';
  }
  function rowHtml(p, canWrite) {
    var low = p.stock <= 5;
    return '<tr>' +
      '<td dir="ltr">' + esc(p.sku) + '</td>' +
      '<td>' + esc(p.name) + '</td>' +
      '<td>' + esc(p.category_name || '-') + '</td>' +
      '<td>' + fmt(p.price) + '</td>' +
      '<td class="' + (low ? 'stock-low' : '') + '">' + fmt(p.stock) + (low ? ' ⚠' : '') + '</td>' +
      '<td>' + (p.is_active ? '<span class="badge badge-green">مفعّل</span>' : '<span class="badge badge-red">معطّل</span>') + '</td>' +
      (canWrite ? '<td><button class="btn btn-ghost btn-sm edit-stock" data-id="' + p.id + '" data-stock="' + p.stock + '" data-name="' + esc(p.name) + '">تعديل المخزون</button></td>' : '') +
    '</tr>';
  }

  async function render(container) {
    var canWrite = SHOP_Auth.hasPermission('products:create');
    var res = await apiGet('/products');
    var products = res.data || [];

    container.innerHTML =
      '<div class="section-head">' +
        '<h3><span class="head-emoji" aria-hidden="true">📦</span>المنتجات والمخزون</h3>' +
        (canWrite ? '<button class="btn btn-primary btn-sm" id="add-product-btn">+ إضافة منتج</button>' : '') +
      '</div>' +
      '<div class="search-bar"><input type="text" id="product-search" class="form-control" placeholder="بحث بالاسم أو الرمز أو التصنيف..."></div>' +
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>الرمز</th><th>الاسم</th><th>التصنيف</th><th>السعر (د.ع)</th><th>المخزون</th><th>الحالة</th>' +
        (canWrite ? '<th>إجراءات</th>' : '') +
      '</tr></thead><tbody id="products-tbody">' +
      (products.length ? products.map(function (p) { return rowHtml(p, canWrite); }).join('') : emptyRow(canWrite ? 7 : 6, 'لا توجد منتجات مسجّلة.')) +
      '</tbody></table></div>';

    var cols = canWrite ? 7 : 6;

    function bindEditButtons() {
      if (!canWrite) return;
      container.querySelectorAll('.edit-stock').forEach(function (btn) {
        btn.addEventListener('click', function () { openStockModal(btn.dataset.id, btn.dataset.name, btn.dataset.stock, container); });
      });
    }

    function renderRows(list) {
      var tbody = document.getElementById('products-tbody');
      if (!tbody) return;
      tbody.innerHTML = list.length
        ? list.map(function (p) { return rowHtml(p, canWrite); }).join('')
        : emptyRow(cols, 'لا توجد نتائج مطابقة.');
      bindEditButtons();
    }

    if (canWrite) {
      var addBtn = document.getElementById('add-product-btn');
      if (addBtn) addBtn.addEventListener('click', function () { openAddModal(container); });
    }
    bindEditButtons();

    var searchInput = document.getElementById('product-search');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        var q = e.target.value.trim().toLowerCase();
        if (!q) { renderRows(products); return; }
        renderRows(products.filter(function (p) {
          return String(p.name || '').toLowerCase().includes(q) ||
                 String(p.sku || '').toLowerCase().includes(q) ||
                 String(p.category_name || '').toLowerCase().includes(q);
        }));
      });
    }
  }

  async function openAddModal(container) {
    var cats = (await apiGet('/categories')).data || [];
    global.SHOP_Modal.open('إضافة منتج جديد',
      '<div class="form-group"><label class="form-label">الرمز (SKU)</label><input class="form-control" id="m-sku"></div>' +
      '<div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="m-name"></div>' +
      '<div class="form-group"><label class="form-label">التصنيف</label><select class="form-control" id="m-cat">' +
        cats.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label">السعر (د.ع)</label><input type="number" min="0" class="form-control" id="m-price"></div>' +
      '<div class="form-group"><label class="form-label">المخزون الأوّلي</label><input type="number" min="0" class="form-control" id="m-stock" value="0"></div>',
      async function () {
        var payload = {
          sku: document.getElementById('m-sku').value.trim(),
          name: document.getElementById('m-name').value.trim(),
          category_id: Number(document.getElementById('m-cat').value),
          price: Number(document.getElementById('m-price').value),
          stock: Number(document.getElementById('m-stock').value),
        };
        if (!payload.sku || !payload.name) { alert('الرمز والاسم مطلوبان'); return false; }
        await apiPost('/products', payload);
        render(container);
        return true;
      });
  }

  function openStockModal(id, name, stock, container) {
    global.SHOP_Modal.open('تعديل مخزون: ' + name,
      '<div class="form-group"><label class="form-label">المخزون الجديد</label>' +
      '<input type="number" min="0" class="form-control" id="m-newstock" value="' + Number(stock) + '"></div>',
      async function () {
        var v = Number(document.getElementById('m-newstock').value);
        if (v < 0) { alert('المخزون لا يكون سالباً'); return false; }
        await apiPatch('/products/' + id, { stock: v });
        render(container);
        return true;
      });
  }

  global.SHOP_Modules = global.SHOP_Modules || {};
  global.SHOP_Modules.products = {
    id: 'products', label: 'المنتجات والمخزون', permission: 'products:read', icon: '📦', render: render,
  };
})(window);
