'use strict';

// =====================================================================
//  miscController — تصنيفات وزبائن (قراءة بسيطة)
// =====================================================================

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ---- GET /api/v1/categories ----
const listCategories = asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT id, name, description FROM categories ORDER BY name`
  );
  res.json({ success: true, data: result.rows });
});

// ---- GET /api/v1/customers ----
const listCustomers = asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT id, full_name, email, phone, address FROM customers ORDER BY created_at DESC`
  );
  res.json({ success: true, data: result.rows });
});

module.exports = { listCategories, listCustomers };
