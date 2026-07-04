# نظام متجر إلكتروني — إدارة المخزون والطلبات بمعاملة ذرّية (ACID)

[![CI](https://github.com/ABOODE39/ecommerce-inventory-acid/actions/workflows/ci.yml/badge.svg)](https://github.com/ABOODE39/ecommerce-inventory-acid/actions)

مشروع مادة قواعد البيانات: نظام متجر إلكتروني بسيط يدير المنتجات والمخزون والطلبات. **الفكرة المحورية** أنّ إنشاء أي طلب يجري داخل **معاملة ذرّية (ACID Transaction)**: تُفحَص كمية المخزون أولاً، ثم تُخصَم ويُنشأ الطلب وأسطره والدفعة **كلّها معاً**؛ وإن نقص المخزون عن المطلوب يُلغى كل شيء (ROLLBACK) فلا يُخصَم مخزون ولا يُنشأ طلب نصفه منفَّذ.

المكدّس: **PostgreSQL 16 + Node.js/Express + واجهة JavaScript عربية (RTL)**.

## الموقع الحيّ (Live Demo)

👉 **[aboode39.github.io/ecommerce-inventory-acid](https://aboode39.github.io/ecommerce-inventory-acid/)**

نسخة عرض تعمل داخل المتصفّح ببيانات تجريبية (GitHub Pages يستضيف ملفّات ثابتة فقط، بلا خادم). تحاكي الواجهة منطق معاملة ACID نفسه — جرّب إنشاء طلب يتجاوز مخزون «سمّاعة بلوتوث» (المتوفّر 3) لترى الإلغاء الكامل. النظام الكامل مع PostgreSQL يُشغّل محلياً ويُختبَر آلياً في كل دفعة عبر GitHub Actions.

## الفريق

| العضو | القاعة |
|------|--------|
| حيدر اركان حسين | B |
| يوسف اياد مجيد | G |
| حسين علي شهاب | B |

- **الجامعة:** جامعة آشور — قسم هندسة الأمن السيبراني — المرحلة الثانية
- **المشرف:** د. علي

## ماذا يفعل

- إدارة المنتجات والتصنيفات والمخزون (إضافة/تعديل/تعطيل).
- إنشاء الطلبات عبر معاملة ACID مع خصم تلقائي للمخزون ودفعة مصاحبة.
- عرض الطلبات وتفاصيلها وتحديث حالتها (مدفوع → مُرسل).
- لوحة تتغيّر حسب دور المستخدم (RBAC).

## الميزة المحورية: معاملة ACID

دالة `place_order()` في `database/03_acid_order.sql` تُنفّذ منطق الطلب كاملاً داخل معاملة واحدة، وخصائص ACID الأربع متحقّقة فيها:

| الخاصية | كيف تتحقّق هنا |
|---------|----------------|
| **A — Atomicity** | خصم المخزون + إنشاء الطلب والأسطر والدفعة يحدث كوحدة واحدة؛ أي فشل يرفع `RAISE EXCEPTION` فيُلغى كل ما سبق. |
| **C — Consistency** | قيود `CHECK (stock >= 0)` و`quantity > 0` والمفاتيح الأجنبية تمنع أي حالة غير صحيحة (لا مخزون سالب، لا طلب لزبون وهمي). |
| **I — Isolation** | `SELECT ... FOR UPDATE` يقفل صفّ المنتج فيمنع طلبين متزامنين من بيع القطعة الأخيرة مرّتين (منع oversell). |
| **D — Durability** | بعد `COMMIT` تُكتب التغييرات إلى WAL على القرص وتبقى حتى لو انهار الخادم. |

## المكدّس التقني

| الطبقة | التقنيات |
|--------|----------|
| قاعدة البيانات | PostgreSQL 16 (دالة PL/pgSQL · pgcrypto · CHECK · FOR UPDATE) — 8 جداول |
| Backend | Node.js 20 + Express + bcryptjs + JWT + pg |
| Frontend | HTML/CSS/JavaScript عربي (RTL)، بلا أُطر + وضع عرض (Demo) |
| الاختبارات | Jest + Supertest — 25 اختباراً (تشمل اختبار ROLLBACK عند نقص المخزون) |

## بنية المشروع

```
ecommerce-inventory-acid/
├── database/
│   ├── 01_schema.sql        # 8 جداول + قيود + trigger
│   ├── 02_rbac.sql          # 4 أدوار + 9 صلاحيات + ربطها
│   ├── 03_acid_order.sql    # دالة place_order — معاملة ACID
│   └── 04_seed.sql          # بيانات تجريبية + طلب عبر الدالة
├── backend/
│   ├── src/{config,controllers,middleware,routes,utils}
│   └── tests/               # rbac + auth (وحدة) + order (تكامل)
├── frontend/                # index + dashboard + js/css + Demo Mode
└── .github/workflows/       # ci.yml (postgres:16 + tests) + pages.yml
```

## التشغيل

**المتطلّبات:** PostgreSQL 16، Node.js 20، متصفّح حديث.

```bash
# 1) قاعدة البيانات — نفّذ الملفّات بالترتيب
createdb ecommerce_db
psql -d ecommerce_db -f database/01_schema.sql
psql -d ecommerce_db -f database/02_rbac.sql
psql -d ecommerce_db -f database/03_acid_order.sql
psql -d ecommerce_db -f database/04_seed.sql

# 2) الخادم
cd backend
npm install
cp .env.example .env        # عدّل DATABASE_URL و JWT_SECRET
npm run dev                 # http://localhost:3000

# 3) الواجهة
cd ../frontend
python -m http.server 8000  # ثم افتح http://localhost:8000
```

## الاختبارات

```bash
cd backend
npm test
```

تشمل: اختبارات وحدة لـ RBAC والمصادقة (بلا قاعدة بيانات)، واختبارات تكامل للمعاملة الذرّية بما فيها **اختبار ROLLBACK** الذي يتحقّق أن المخزون لا يتغيّر ولا يُنشأ طلب عند نقص المخزون.

## حسابات الدخول التجريبية

كلمة المرور للجميع: `Ashur@2026`

| المستخدم | الدور | أبرز الصلاحيات |
|----------|------|----------------|
| `admin`    | مدير النظام | كل الصلاحيات |
| `manager`  | مدير المتجر | إدارة المنتجات/المخزون والطلبات |
| `staff`    | موظّف | عرض المنتجات والطلبات + إنشاء/تحديث الطلبات |
| `customer` | زبون | تصفّح المنتجات + إنشاء طلب |

---

## English Summary

A simple **e-commerce inventory & orders** system whose core feature is an **ACID transaction** for order placement. The PL/pgSQL function `place_order()` checks stock, deducts it, and creates the order, its items, and the payment **atomically inside a single transaction**; insufficient stock raises an exception that rolls back everything — no partial order, no stock change.

- **Stack:** PostgreSQL 16 + Node.js/Express (JWT + bcrypt + simple RBAC) + vanilla Arabic RTL frontend with a browser **Demo Mode** for GitHub Pages.
- **Tests:** Jest + Supertest (25 tests) including a rollback test on insufficient stock.
- **Team:** Haidar Arkan Hussein (Hall B), Yousif Ayad Majeed (Hall G), Hussein Ali Shihab (Hall B) — Ashur University, Cybersecurity Engineering Dept., Stage 2. Supervisor: Dr. Ali.
- **License:** MIT.
