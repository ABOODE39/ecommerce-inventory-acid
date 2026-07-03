'use strict';

// =====================================================================
//  اختبارات وحدة للمصادقة — JWT + authenticate middleware + bcrypt
//  لا تحتاج قاعدة بيانات
// =====================================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-32-characters!!';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../src/middleware/auth');

function mock(headers) {
  const req = { headers: headers || {} };
  const res = {};
  let nextErr;
  const next = (err) => { nextErr = err; };
  return { req, res, next, getErr: () => nextErr };
}

describe('authenticate middleware', () => {
  test('يرفض الطلب بلا توكن (401 TOKEN_MISSING)', () => {
    const m = mock({});
    authenticate(m.req, m.res, m.next);
    expect(m.getErr().statusCode).toBe(401);
    expect(m.getErr().code).toBe('TOKEN_MISSING');
  });

  test('يرفض توكناً غير صالح (401 TOKEN_INVALID)', () => {
    const m = mock({ authorization: 'Bearer not.a.real.token' });
    authenticate(m.req, m.res, m.next);
    expect(m.getErr().statusCode).toBe(401);
    expect(m.getErr().code).toBe('TOKEN_INVALID');
  });

  test('يقبل توكناً صالحاً ويعبّئ req.user', () => {
    const token = jwt.sign(
      { sub: 'u-1', username: 'admin', role: 'admin', permissions: ['products:read'] },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const m = mock({ authorization: 'Bearer ' + token });
    authenticate(m.req, m.res, m.next);
    expect(m.getErr()).toBeUndefined();
    expect(m.req.user.id).toBe('u-1');
    expect(m.req.user.role).toBe('admin');
    expect(m.req.user.permissions).toContain('products:read');
  });

  test('يرفض توكناً منتهياً (401 TOKEN_EXPIRED)', () => {
    const token = jwt.sign({ sub: 'u-1' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const m = mock({ authorization: 'Bearer ' + token });
    authenticate(m.req, m.res, m.next);
    expect(m.getErr().code).toBe('TOKEN_EXPIRED');
  });
});

describe('bcrypt password hashing', () => {
  test('compare ينجح مع كلمة المرور الصحيحة', async () => {
    const hash = await bcrypt.hash('Ashur@2026', 4);
    expect(await bcrypt.compare('Ashur@2026', hash)).toBe(true);
  });

  test('compare يفشل مع كلمة مرور خاطئة', async () => {
    const hash = await bcrypt.hash('Ashur@2026', 4);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });

  test('الكلمة لا تُخزَّن خاماً (الهاش يختلف عنها)', async () => {
    const hash = await bcrypt.hash('Ashur@2026', 4);
    expect(hash).not.toBe('Ashur@2026');
    expect(hash.startsWith('$2')).toBe(true);
  });
});
