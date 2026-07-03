'use strict';

// =====================================================================
//  AppError — خطأ تشغيلي يحمل كود HTTP ورمز خطأ موحَّد
// =====================================================================

class AppError extends Error {
  /**
   * @param {string} message    - رسالة موجَّهة للمستخدم
   * @param {number} statusCode  - كود HTTP (400, 401, 403, 404, 409...)
   * @param {string} [code]     - رمز ثابت للعميل مثل 'INSUFFICIENT_STOCK'
   */
  constructor(message, statusCode, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
