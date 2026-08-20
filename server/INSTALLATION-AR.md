# دليل التثبيت خطوة بخطوة (بالعربية)

## الجزء 1 — جهاز السيرفر (حاسوب واحد فقط)

### 1. تحميل البرامج
- Node.js LTS: https://nodejs.org (اضغط Next حتى النهاية)
- PostgreSQL 16: https://www.postgresql.org/download/windows/
  - أثناء التثبيت سيطلب **كلمة سر للمستخدم postgres** — اكتبها واحفظها (مثلاً `postgres`).
  - اترك المنفذ 5432 كما هو.

### 2. إضافة psql إلى PATH
- ابحث في Windows عن «Variables d'environnement» → Path → Modifier → Nouveau
- أضف: `C:\Program Files\PostgreSQL\16\bin`
- أغلق كل نوافذ cmd وافتحها من جديد.

### 3. التثبيت الآلي
- افتح مجلد `server` داخل المشروع.
- اضغط بالزر الأيمن على `setup-windows.bat` → **Exécuter en tant qu'administrateur**.
- سيطلب منك كلمة سر `postgres` عدة مرات — أدخلها.
- في النهاية سيعرض عنوان السيرفر مثل: `http://192.168.1.36:3000`

### 4. التحقق
افتح المتصفح على نفس الجهاز:
```
http://localhost:3000/api/health
```
يجب أن ترى `{"status":"ok"}`.

ثم من حاسوب آخر في نفس الشبكة:
```
http://192.168.1.36:3000/api/health
```
إذا لم يعمل من الحاسوب الآخر:
```powershell
New-NetFirewallRule -DisplayName "LogixStore 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

---

## الجزء 2 — أجهزة الكاشير (حتى 10 أجهزة)

1. ثبّت التطبيق (`LogixStore.exe`) أو شغّله بـ `npm run electron:dev`.
2. افتح صفحة **État du serveur** من القائمة الجانبية.
3. اكتب عنوان السيرفر: `http://192.168.1.36:3000`
4. اضغط **Tester la connexion** — يجب أن تظهر 🟢.
5. اختر رقم الطرفية: `POS-01` للجهاز الأول، `POS-02` للثاني… حتى `POS-10`.
6. فعّل مفتاح **Synchronisation**.

## الجزء 3 — شاشات عرض الأسعار (حتى 6)
- افتح صفحة `/display` على الشاشة الموجهة للزبون.
- اختر رقم الشاشة: `DISPLAY-01` … `DISPLAY-06`.

---

## الحسابات
- الدخول الأول: `proprietaire` / `Owner123456` (غيّر كلمة السر فوراً).
- أنشئ حساباً لكل كاشير من صفحة المستخدمين حتى يعمل الجميع في نفس الوقت.

## مشاكل شائعة
| الرسالة | السبب | الحل |
|---|---|---|
| `Délai dépassé` | جدار الحماية | نفّذ أمر New-NetFirewallRule أعلاه |
| `Failed to fetch` | السيرفر متوقف أو IP خاطئ | شغّل `npm run dev` وتحقق بـ `ipconfig` |
| `password authentication failed` | كلمة سر قاعدة البيانات | صحّح `DATABASE_URL` في `server/.env` |
| `psql n'est pas reconnu` | PATH ناقص | أضف مجلد `PostgreSQL\16\bin` إلى PATH |

## أوامر يدوية (بديل عن ملف .bat)
```bat
cd server
psql -U postgres -c "CREATE USER logixstore WITH PASSWORD 'logix2024';"
psql -U postgres -c "CREATE DATABASE logixstore OWNER logixstore;"
npm install
npm run db:push
npm run db:seed
npm run dev
```
