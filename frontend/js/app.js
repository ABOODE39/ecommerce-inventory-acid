/* =====================================================================
   app.js — منسّق لوحة التحكم + نافذة منبثقة بسيطة
   ===================================================================== */

(function (global) {
  'use strict';

  if (!SHOP_Auth.requireAuth()) return;

  var user = SHOP_Auth.getCurrentUser();

  /* ── نافذة منبثقة قابلة لإعادة الاستخدام ── */
  var overlay;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal"><h3 id="modal-title"></h3><div id="modal-body"></div>' +
      '<div class="modal-actions"><button class="btn btn-primary btn-sm" id="modal-ok"></button>' +
      '<button class="btn btn-ghost btn-sm" id="modal-cancel">إغلاق</button></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.getElementById('modal-cancel').addEventListener('click', close);
    return overlay;
  }
  function open(title, bodyHtml, onConfirm, okLabel) {
    ensureOverlay();
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    var ok = document.getElementById('modal-ok');
    if (onConfirm) {
      ok.style.display = '';
      ok.textContent = okLabel || 'حفظ';
      ok.onclick = async function () {
        ok.disabled = true;
        try { var done = await onConfirm(); if (done !== false) close(); }
        finally { ok.disabled = false; }
      };
    } else {
      ok.style.display = 'none';
    }
    overlay.classList.add('open');
  }
  function close() { if (overlay) overlay.classList.remove('open'); }
  global.SHOP_Modal = { open: open, close: close };

  /* ── الشريط العلوي ── */
  function initTopbar() {
    document.getElementById('tb-name').textContent = user.full_name || user.username;
    document.getElementById('tb-role').textContent = roleLabel(user.role);
    document.getElementById('tb-avatar').textContent = (user.full_name || user.username || '?').charAt(0);
  }
  function roleLabel(r) {
    return { admin: 'مدير النظام', manager: 'مدير المتجر', staff: 'موظّف', customer: 'زبون' }[r] || r;
  }

  /* ── بناء القائمة من الوحدات المتاحة حسب الصلاحية ── */
  function buildNav() {
    var order = ['overview', 'products', 'orders'];
    var mods = order.map(id => global.SHOP_Modules[id]).filter(Boolean)
      .filter(m => SHOP_Auth.hasPermission(m.permission));

    var nav = document.getElementById('nav');
    nav.innerHTML = '';
    mods.forEach(function (m, i) {
      var el = document.createElement('div');
      el.className = 'nav-item' + (i === 0 ? ' active' : '');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', m.label);
      el.innerHTML = '<span class="nav-icon" aria-hidden="true">' + (m.icon || '') + '</span>' +
        '<span>' + m.label + '</span>';
      function select() {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        activate(m);
      }
      el.addEventListener('click', select);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
      nav.appendChild(el);
    });
    if (mods.length) activate(mods[0]);
    else document.getElementById('content').innerHTML = '<div class="alert alert-error">لا توجد وحدات متاحة لدورك.</div>';
  }

  async function activate(mod) {
    document.getElementById('tb-title').textContent = mod.label;
    var content = document.getElementById('content');
    content.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
    try { await mod.render(content); }
    catch (e) { content.innerHTML = '<div class="alert alert-error">تعذّر التحميل: ' + (e.message || '') + '</div>'; }
  }

  document.getElementById('logout-btn').addEventListener('click', function () {
    if (confirm('تسجيل الخروج؟')) SHOP_Auth.logout();
  });

  initTopbar();
  buildNav();
})(window);
