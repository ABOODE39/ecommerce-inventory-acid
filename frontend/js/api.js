/* =====================================================================
   api.js — طبقة التواصل مع الـ Backend
   يكتشف وضع العرض (Demo) تلقائياً على GitHub Pages أو file://
   ===================================================================== */

(function (global) {
  'use strict';

  var DEMO_MODE = (
    window.FORCE_DEMO === true ||
    /(?:[?&])demo=1(?:&|$)/.test(location.search) ||
    localStorage.getItem('shop_force_demo') === '1' ||
    location.hostname.endsWith('github.io') ||
    location.hostname.includes('pages.dev') ||
    location.hostname.includes('netlify.app') ||
    location.protocol === 'file:'
  );

  var BASE = 'http://localhost:3000/api/v1';

  function getToken() { return localStorage.getItem('shop_token') || ''; }

  function buildHeaders() {
    var token = getToken();
    return Object.assign(
      { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      token ? { 'Authorization': 'Bearer ' + token } : {}
    );
  }

  function ApiError(message, status) {
    this.message = message; this.status = status; this.name = 'ApiError';
  }
  ApiError.prototype = Object.create(Error.prototype);

  async function handleResponse(res) {
    if (res.status === 401) {
      localStorage.removeItem('shop_token');
      localStorage.removeItem('shop_user');
      if (!location.pathname.endsWith('index.html')) location.href = 'index.html';
      throw new ApiError('انتهت الجلسة', 401);
    }
    var body;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) {
      var msg = body?.error?.message || body?.message || ('خطأ ' + res.status);
      throw new ApiError(msg, res.status);
    }
    return body;
  }

  async function demoCall(method, path, body) {
    if (!global.DEMO) throw new ApiError('demo-data.js غير محمّل', 500);
    return global.DEMO.handle(method, path, body);
  }

  async function apiGet(path, params) {
    var full = path;
    if (params && Object.keys(params).length) full += '?' + new URLSearchParams(params).toString();
    if (DEMO_MODE) return demoCall('GET', full, null);
    return handleResponse(await fetch(BASE + full, { method: 'GET', headers: buildHeaders() }));
  }
  async function apiPost(path, body) {
    if (DEMO_MODE) return demoCall('POST', path, body);
    return handleResponse(await fetch(BASE + path, { method: 'POST', headers: buildHeaders(), body: JSON.stringify(body || {}) }));
  }
  async function apiPatch(path, body) {
    if (DEMO_MODE) return demoCall('PATCH', path, body);
    return handleResponse(await fetch(BASE + path, { method: 'PATCH', headers: buildHeaders(), body: JSON.stringify(body || {}) }));
  }
  async function apiDelete(path) {
    if (DEMO_MODE) return demoCall('DELETE', path, null);
    return handleResponse(await fetch(BASE + path, { method: 'DELETE', headers: buildHeaders() }));
  }

  global.apiGet = apiGet; global.apiPost = apiPost;
  global.apiPatch = apiPatch; global.apiDelete = apiDelete;
  global.ApiError = ApiError;
  global.SHOP_DEMO_MODE = DEMO_MODE;
})(window);
