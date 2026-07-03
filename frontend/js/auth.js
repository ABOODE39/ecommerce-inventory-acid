/* =====================================================================
   auth.js — إدارة المصادقة والجلسة
   ===================================================================== */

(function (global) {
  'use strict';

  var TOKEN_KEY = 'shop_token';
  var USER_KEY  = 'shop_user';

  async function handleLogin(username, password) {
    try {
      var data = await apiPost('/auth/login', { username, password });
      var token = data.data?.access_token;
      var user  = data.data?.user;
      if (!token) return { ok: false, message: 'لم يُستلم رمز المصادقة' };
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      location.href = 'dashboard.html';
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || 'فشل تسجيل الدخول' };
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.href = 'index.html';
  }

  function getCurrentUser() {
    try { var raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }

  function requireAuth() {
    if (!localStorage.getItem(TOKEN_KEY)) { location.href = 'index.html'; return false; }
    return true;
  }

  function hasPermission(code) {
    var user = getCurrentUser();
    return !!(user && (user.permissions || []).includes(code));
  }

  global.SHOP_Auth = { handleLogin, logout, getCurrentUser, requireAuth, hasPermission };
})(window);
