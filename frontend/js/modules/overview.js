/* =====================================================================
   modules/overview.js — لوحة موجزة (إحصاءات سريعة)
   ===================================================================== */

(function (global) {
  'use strict';

  function fmt(n) { return Number(n || 0).toLocaleString('ar-IQ'); }

  async function render(container) {
    var products = (await apiGet('/products')).data || [];
    var orders = [];
    try { orders = (await apiGet('/orders')).data || []; } catch (e) { /* الزبون لا يرى الطلبات */ }

    var totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
    var lowStock = products.filter(p => p.is_active && p.stock <= 5).length;
    var revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount || 0), 0);

    container.innerHTML =
      '<div class="section-head"><h3><span class="head-emoji" aria-hidden="true">🛒</span>نظرة عامة</h3></div>' +
      '<div class="grid-cards">' +
        card('📦', fmt(products.filter(p => p.is_active).length), 'منتجات مفعّلة') +
        card('🔢', fmt(totalStock), 'إجمالي القطع بالمخزون') +
        card('⚠️', fmt(lowStock), 'منتجات مخزونها منخفض') +
        card('🧾', fmt(orders.length), 'إجمالي الطلبات') +
        card('💰', fmt(revenue) + ' د.ع', 'إيراد الطلبات') +
      '</div>' +
      '<div class="alert alert-success">' +
        'هذا النظام يستخدم <strong>معاملة ACID</strong> عند إنشاء كل طلب: يُفحص المخزون ويُخصم ويُنشأ الطلب والدفعة معاً داخل معاملة واحدة، وتُلغى بالكامل عند نقص المخزون.' +
      '</div>';
  }

  function card(ic, num, lbl) {
    return '<div class="stat-card"><div class="stat-icon">' + ic + '</div>' +
      '<div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>';
  }

  global.SHOP_Modules = global.SHOP_Modules || {};
  global.SHOP_Modules.overview = {
    id: 'overview', label: 'نظرة عامة', permission: 'products:read', icon: '🛒', render: render,
  };
})(window);
