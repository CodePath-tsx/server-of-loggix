# ManagByte ERP

نظام إدارة محلي متكامل — نقطة بيع، مخزون، تقارير، عملاء وموردون.  
يعمل في المتصفح (localStorage) وفي Electron (SQLite).

## Stack

| طبقة | التقنية |
|---|---|
| UI | React 19, TanStack Router, Tailwind CSS v4, Radix UI (shadcn) |
| State | Zustand (localStorage في المتصفح، SQLite في Electron) |
| Build | Vite 8 + Bun + TanStack Start (SSR للويب) |
| Desktop | Electron + better-sqlite3 |
| Auth | Custom RBAC — Administrator / Manager / Cashier |
| i18n | i18next (ar / fr / en) |
| License | Ed25519 (Web Crypto) — توقيع رقمي بدون سيرفر |

## تشغيل المعاينة (Replit)

```bash
bun run dev -- --port 5000 --host 0.0.0.0 --strictPort
```

Workflow: **Start application** — يعمل على port 5000.

## أول استخدام (المتصفح)

1. `/setup` — معالج الإعداد (الشركة ← المستخدمون ← اللغة/العملة)
2. `/activate` — أدخل مفتاح الترخيص (انظر أدناه)
3. `/login` — سجّل الدخول بالحساب الذي أنشأته في الإعداد

## مفتاح الترخيص التجريبي (للتطوير)

هذا المفتاح يعمل على **أي جهاز** (machineId = "*"):

```
MB1.eyJjdXN0b21lciI6IkRldmVsb3BlciIsImNvbXBhbnkiOiJNYW5hZ0J5dGUgRGV2IiwibWFjaGluZUlkIjoiKiIsInR5cGUiOiJsaWZldGltZSIsImlzc3VlZEF0IjoiMjAyNi0wNy0wNlQxMTo1NzozNi42MzZaIiwiZmVhdHVyZXMiOlsicG9zIiwicmVwb3J0cyIsImJhY2t1cCIsInByaW50aW5nIiwibXVsdGktYnJhbmNoIl0sIm5vbmNlIjoiUVgzaFJ5NVRxSTQifQ.85jjkjQFsg8HQgMWRj-GFs7Hd95P6ClfbTqAIkbcT1P2WYNmaUNnv8mvS-HHvfvqSZqcOgy73RIDW6iWr96pCw
```

**لإصدار مفاتيح للعملاء:** انظر `docs/LICENSE-KEYS.md`

## تشغيل Electron (محلياً)

### 1. تثبيت المتطلبات (مرة واحدة)
```bash
bun add -D electron electron-builder @electron/rebuild
bun add better-sqlite3
bun run electron:rebuild    # يبني better-sqlite3 لـ Electron
```

### 2. تشغيل في وضع التطوير
```bash
# في نافذة أولى: شغّل Vite dev server
bun run dev

# في نافذة ثانية: شغّل Electron
bun run electron:dev
```

### 3. بناء ملف التثبيت (.exe / .dmg)
```bash
bun run electron:dist    # يبني SPA ثم يُنتج المثبّت
```

ستجد الملف في `dist-packages/`.

## هيكل المشروع

| المسار | الوصف |
|---|---|
| `src/routes/` | صفحات التطبيق (TanStack Router) |
| `src/lib/mb-store.ts` | Zustand store — البيانات + IPC sync |
| `src/lib/auth.ts` | المصادقة + RBAC + session sync |
| `src/lib/seed.ts` | getMachineId + بيانات تجريبية |
| `src/lib/ipc-bridge.ts` | أنواع TypeScript لـ window.electronAPI |
| `src/core/` | منطق الأعمال (ترخيص، أخطاء، RBAC) |
| `electron/main.cjs` | Electron main process |
| `electron/preload.cjs` | Context bridge (يُعرّض electronAPI) |
| `electron/database.cjs` | SQLite — جميع عمليات الجداول |
| `vite.electron.config.ts` | Vite SPA build لـ Electron |
| `electron-builder.yml` | إعدادات تغليف التطبيق |
| `assets/icon.svg` | أيقونة التطبيق |
| `scripts/license-generator.mjs` | CLI لإنشاء مفاتيح الترخيص |
| `docs/LICENSE-KEYS.md` | شرح نظام الترخيص كاملاً |

## معمارية SQLite

عند تشغيل التطبيق داخل Electron:
- `electron/database.cjs` يفتح `~userData/managbyte.db` (better-sqlite3)
- عند بدء التشغيل: `getStateSync()` يحمّل كل البيانات من SQLite مزامنةً → Zustand يبدأ مملوءاً
- عند كل تعديل: `syncDb()` يُرسل IPC fire-and-forget → SQLite يُحدَّث
- بيع POS: `addSaleWithMovements` → transaction واحدة تشمل الفاتورة + تعديل المخزون + حركات المخزون

## هوية التطبيق

- `package.json`: `name: managbyte`, `version: 1.0.0`
- `electron-builder.yml`: `appId: com.managbyte.erp`, `productName: ManagByte ERP`
- لتغيير الأيقونة: استبدل `assets/icon.svg` بـ `.png` (512×512) وأنتج `.ico` و`.icns` منه

## User preferences

- لا تُغيّر هيكل المشروع أو تُهاجره بدون أمر صريح.
