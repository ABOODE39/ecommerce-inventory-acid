'use strict';

// =====================================================================
//  productController — CRUD المنتجات والمخزون
// =====================================================================

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError     = require('../utils/AppError');

// ---- GET /api/v1/products ----
const list = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.id, p.sku, p.name, p.description, p.price, p.stock, p.is_active,
            c.name AS category_name, p.category_id
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC`
  );
  res.json({ success: true, data: result.rows });
});

// ---- GET /api/v1/products/:id ----
const getOne = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.id, p.sku, p.name, p.description, p.price, p.stock, p.is_active,
            c.name AS category_name, p.category_id
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) throw new AppError('المنتج غير موجود', 404, 'PRODUCT_NOT_FOUND');
  res.json({ success: true, data: result.rows[0] });
});

// ---- POST /api/v1/products ----
const create = asyncHandler(async (req, res) => {
  const { sku, name, description, category_id, price, stock } = req.body;
  if (!sku || !name || price == null) {
    throw new AppError('sku و name و price مطلوبة', 400, 'VALIDATION_ERROR');
  }
  if (Number(price) < 0 || (stock != null && Number(stock) < 0)) {
    throw new AppError('السعر والمخزون لا يمكن أن يكونا سالبين', 400, 'VALIDATION_ERROR');
  }

  const result = await query(
    `INSERT INTO products (sku, name, description, category_id, price, stock)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, sku, name, description, category_id, price, stock, is_active`,
    [sku, name, description || null, category_id || null, price, stock || 0]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

// ---- PATCH /api/v1/products/:id ----
const update = asyncHandler(async (req, res) => {
  const { name, description, category_id, price, stock, is_active } = req.body;
  if (price != null && Number(price) < 0) {
    throw new AppError('السعر لا يمكن أن يكون سالباً', 400, 'VALIDATION_ERROR');
  }
  if (stock != null && Number(stock) < 0) {
    throw new AppError('المخزون لا يمكن أن يكون سالباً', 400, 'VALIDATION_ERROR');
  }

  const result = await query(
    `UPDATE products SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        category_id = COALESCE($3, category_id),
        price       = COALESCE($4, price),
        stock       = COALESCE($5, stock),
        is_active   = COALESCE($6, is_active)
      WHERE id = $7
      RETURNING id, sku, name, description, category_id, price, stock, is_active`,
    [name ?? null, description ?? null, category_id ?? null,
     price ?? null, stock ?? null, is_active ?? null, req.params.id]
  );
  if (!result.rows[0]) throw new AppError('المنتج غير موجود', 404, 'PRODUCT_NOT_FOUND');
  res.json({ success: true, data: result.rows[0] });
});

// ---- DELETE /api/v1/products/:id  (تعطيل ناعم) ----
const remove = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!result.rows[0]) throw new AppError('المنتج غير موجود', 404, 'PRODUCT_NOT_FOUND');
  res.json({ success: true, data: { id: result.rows[0].id, deactivated: true } });
});

module.exports = { list, getOne, create, update, remove };
