'use strict';

// =====================================================================
//  Express Application — middleware + المسارات + معالج الأخطاء
// =====================================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const AppError      = require('./utils/AppError');
const authRoutes    = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes   = require('./routes/orderRoutes');
const miscRoutes    = require('./routes/miscRoutes');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50kb' }));

// المسارات
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders',   orderRoutes);
app.use('/api/v1',          miscRoutes); // /categories , /customers

// مسار الصحة
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, _res, next) => {
  next(new AppError(`المسار ${req.originalUrl} غير موجود`, 404, 'ROUTE_NOT_FOUND'));
});

// معالج الأخطاء المركزي
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // قيمة مكرّرة (unique violation)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_ENTRY', message: 'قيمة مكرّرة — السجل موجود مسبقاً' },
    });
  }
  // مخالفة قيد CHECK (مثل مخزون سالب)
  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      error: { code: 'CONSTRAINT_VIOLATION', message: 'قيمة غير مقبولة من قاعدة البيانات' },
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'حدث خطأ داخلي في الخادم' },
  });
});

module.exports = app;
