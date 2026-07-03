'use strict';

// =====================================================================
//  إعداد اتصال قاعدة البيانات — PostgreSQL Pool
//  withTransaction: غلاف معاملة (BEGIN/COMMIT/ROLLBACK) لمعاملات ACID
// =====================================================================

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] خطأ غير متوقع في Pool:', err.message);
});

/**
 * query — استعلام عادي بسيط من الـ Pool
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * withTransaction — يُنفّذ fn(client) داخل معاملة واحدة.
 *  BEGIN ثم تشغيل fn ثم COMMIT؛ وعند أي خطأ ROLLBACK كامل.
 *  هذا هو الغلاف الذي يضمن خصائص ACID لنقطة إنشاء الطلب:
 *   - فحص المخزون وخصمه وإنشاء الطلب والدفعة يحدث كلّه أو لا شيء.
 *
 * @param {Function} fn - async (client) => result
 * @returns {Promise<*>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK'); // إلغاء كل التغييرات عند الفشل
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
