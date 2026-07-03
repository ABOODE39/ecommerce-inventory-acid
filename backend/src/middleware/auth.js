'use strict';

// =====================================================================
//  authenticate — التحقّق من JWT وتعبئة req.user
// =====================================================================

require('dotenv').config();
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return next(new AppError('الرمز مطلوب — أرسل Authorization: Bearer <token>', 401, 'TOKEN_MISSING'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:          payload.sub,
      username:    payload.username,
      role:        payload.role,
      customer_id: payload.customer_id || null,
      permissions: payload.permissions || [],
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('انتهت صلاحية الرمز — سجّل الدخول من جديد', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('رمز غير صالح', 401, 'TOKEN_INVALID'));
  }
}

module.exports = { authenticate };
