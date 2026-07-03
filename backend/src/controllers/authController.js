'use strict';

// =====================================================================
//  authController — تسجيل الدخول وبيانات الحساب
//  login: يتحقق bcrypt ويُصدر JWT يحمل الدور والصلاحيات
//  me:    يُعيد ملف المستخدم المصادَق
// =====================================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError     = require('../utils/AppError');

/** جلب صلاحيات المستخدم عبر دوره */
async function fetchPermissions(userId) {
  const result = await query(
    `SELECT permission_code FROM user_permissions WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map((r) => r.permission_code);
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}

// ---- POST /api/v1/auth/login ----
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new AppError('username و password مطلوبان', 400, 'VALIDATION_ERROR');
  }

  const result = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.password_hash, u.is_active,
            r.name AS role, c.id AS customer_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN customers c ON c.user_id = u.id
      WHERE u.username = $1`,
    [username]
  );

  const user = result.rows[0];
  const invalid = new AppError('بيانات الدخول غير صحيحة', 401, 'INVALID_CREDENTIALS');
  if (!user) throw invalid;
  if (!user.is_active) throw new AppError('الحساب معطَّل', 403, 'ACCOUNT_DISABLED');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw invalid;

  const permissions = await fetchPermissions(user.id);

  const token = signToken({
    sub:         user.id,
    username:    user.username,
    role:        user.role,
    customer_id: user.customer_id,
    permissions,
  });

  res.status(200).json({
    success: true,
    data: {
      access_token: token,
      token_type:   'Bearer',
      expires_in:   process.env.JWT_EXPIRES_IN || '2h',
      user: {
        id:          user.id,
        username:    user.username,
        email:       user.email,
        full_name:   user.full_name,
        role:        user.role,
        customer_id: user.customer_id,
        permissions,
      },
    },
  });
});

// ---- GET /api/v1/auth/me ----
const me = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.username, u.email, u.full_name, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) throw new AppError('المستخدم غير موجود', 404, 'USER_NOT_FOUND');

  res.status(200).json({
    success: true,
    data: { ...user, customer_id: req.user.customer_id, permissions: req.user.permissions },
  });
});

module.exports = { login, me };
