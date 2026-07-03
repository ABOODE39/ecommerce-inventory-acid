'use strict';

// =====================================================================
//  نقطة الدخول — تشغيل Express
// =====================================================================

require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/db');

const PORT = parseInt(process.env.PORT, 10) || 3000;

const server = app.listen(PORT, () => {
  console.log(`[Server] يعمل على المنفذ ${PORT} — البيئة: ${process.env.NODE_ENV || 'development'}`);
});

// إغلاق أنيق
async function gracefulShutdown(signal) {
  console.log(`\n[Server] استُقبِل ${signal} — جارٍ الإغلاق...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = server;
