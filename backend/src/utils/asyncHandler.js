'use strict';

// =====================================================================
//  asyncHandler — يلتفّ حول متحكمات async ويُحيل أي خطأ لـ next()
// =====================================================================

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
