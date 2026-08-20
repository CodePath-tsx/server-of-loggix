# StoreSync Enterprise

https://github.com/CodePath-tsx/LOGIXSTORE-ERP.git clone this repo then remove all the language and make all the app on freanch then do all this ╔══════════════════════════════════════════════════════════════╗

║              🚀 POS ENTERPRISE UPGRADE                      ║

║          Electron + SQLite → Multi-Terminal POS             ║

╚══════════════════════════════════════════════════════════════╝

1️⃣ ARCHITECTURE

──────────────────────────────────────────────────────────────

❌ القديم:

Electron → SQLite

✅ الجديد:

Electron

   ↓

React / TypeScript

   ↓

IPC

   ↓

Local SQLite

   ↓

Sync Engine

   ↓

REST API / WebSocket

   ↓

Node.js Server

   ↓

PostgreSQL

2️⃣ SERVER

──────────────────────────────────────────────────────────────

أنشئ Server مستقل:

• Node.js

• Fastify أو NestJS

• TypeScript

• PostgreSQL

• Drizzle ORM

• REST API

• WebSocket

• JWT Authentication

• Role-Based Access Control

• Audit Logs

• Database Backup

3️⃣ DATABASE

──────────────────────────────────────────────────────────────

❌ لا تستخدم SQLite مشترك بين الأجهزة.

❌ لا:

PC1 ─┐

PC2 ─┼── shared/database.sqlite

PC3 ─┘

✅:

PC1 ─┐

PC2 ─┤

PC3 ─┼── API ── PostgreSQL

PC4 ─┘

4️⃣ LOCAL SQLITE

──────────────────────────────────────────────────────────────

احتفظ بـ SQLite داخل كل جهاز كـ Local Database.

يحتوي على:

• products_cache

• customers_cache

• categories_cache

• settings

• pending_operations

• sync_queue

• local_user_session

• local_terminal

• cached_sales

وظيفته:

• Offline mode

• Cache

• سرعة التطبيق

• تخزين العمليات التي لم تتم مزامنتها

5️⃣ SERVER DATABASE TABLES

──────────────────────────────────────────────────────────────

أنشئ جداول مثل:

users

roles

permissions

stores

branches

terminals

products

categories

brands

units

inventory

inventory_movements

customers

suppliers

sales

sale_items

payments

returns

return_items

purchases

purchase_items

expenses

cash_registers

cash_movements

discounts

taxes

audit_logs

sync_operations

settings

6️⃣ MULTI-STORE

──────────────────────────────────────────────────────────────

أضف:

store_id

branch_id

لكل البيانات المهمة.

مثال:

products

 └── store_id

sales

 └── store_id

inventory

 └── store_id

users

 └── store_id

حتى تستطيع مستقبلاً دعم:

Store A

Store B

Store C

7️⃣ MULTI-TERMINAL

──────────────────────────────────────────────────────────────

كل جهاز POS يحصل على:

terminal_id

مثلاً:

POS-01

POS-02

POS-03

POS-04

كل عملية بيع تسجل:

sale_id

store_id

terminal_id

user_id

created_at

8️⃣ USERS & ROLES

──────────────────────────────────────────────────────────────

Roles:

👑 Owner

🛡 Admin

👔 Manager

💰 Cashier

📦 Stock Manager

📊 Accountant

كل Role لديه Permissions.

مثال:

Cashier:

✓ Create Sale

✓ Print Invoice

✓ Search Product

✗ Delete Sale

✗ Change Cost

✗ Modify Stock

9️⃣ AUTHENTICATION

──────────────────────────────────────────────────────────────

أضف:

• Login

• JWT

• Refresh Token

• Password Hashing

• Session Management

• Device/Terminal Registration

• Logout

• Token Expiration

لا تخزن كلمات السر كنص عادي.

🔟 API

──────────────────────────────────────────────────────────────

أنشئ API منظمة:

/api/auth

/api/users

/api/products

/api/categories

/api/inventory

/api/sales

/api/returns

/api/customers

/api/suppliers

/api/purchases

/api/payments

/api/reports

/api/settings

/api/sync

مثلاً:

POST /api/sales

GET /api/products

POST /api/products

PATCH /api/products/:id

GET /api/inventory

1️⃣1️⃣ WEBSOCKET

──────────────────────────────────────────────────────────────

استخدم WebSocket للأحداث الفورية.

مثلاً:

POS 1

  ↓

بيع Product X

  ↓

Server

  ↓

Inventory Updated

  ↓

WebSocket

  ↓

POS 2

POS 3

POS 4

وبالتالي المخزون يتحدث مباشرة.

1️⃣2️⃣ OFFLINE MODE

──────────────────────────────────────────────────────────────

إذا انقطع Server:

Internet/LAN ❌

POS لا يتوقف.

بل:

Sale

 ↓

SQLite

 ↓

pending_operations

 ↓

Queue

عند عودة الاتصال:

SQLite

 ↓

Sync Engine

 ↓

Server

 ↓

PostgreSQL

 ↓

SUCCESS

 ↓

Mark as Synced

1️⃣3️⃣ SYNC ENGINE

──────────────────────────────────────────────────────────────

أنشئ:

SyncManager

وظائفه:

• Detect Connection

• Push Pending Operations

• Pull Server Changes

• Retry Failed Operations

• Conflict Detection

• Conflict Resolution

• Sync Status

مثال:

pending_operations

id

operation

entity

entity_id

payload

created_at

status

retry_count

1️⃣4️⃣ TRANSACTIONS

──────────────────────────────────────────────────────────────

البيع يجب أن يكون Transaction.

مثلاً:

BEGIN

Create Sale

Create Sale Items

Create Payment

Decrease Inventory

Create Inventory Movement

COMMIT

إذا حدث خطأ:

ROLLBACK

1️⃣5️⃣ INVENTORY SYSTEM

──────────────────────────────────────────────────────────────

لا تجعل المخزون مجرد:

product.stock

بل استخدم:

inventory

inventory_movements

مثلاً:

PURCHASE

SALE

RETURN

ADJUSTMENT

DAMAGE

TRANSFER

كل تغيير في المخزون يسجل كـ Movement.

1️⃣6️⃣ UNIQUE IDs

──────────────────────────────────────────────────────────────

لا تعتمد فقط على Auto Increment.

استخدم UUID أو ULID.

مثلاً:

sale:

01K2XXXXXXX

product:

01K2XXXXXXX

حتى لا يحدث تعارض بين الأجهزة.

1️⃣7️⃣ AUDIT LOG

──────────────────────────────────────────────────────────────

سجل العمليات المهمة:

• من حذف؟

• من عدل؟

• من غير السعر؟

• من أرجع المنتج؟

• من عدل المخزون؟

• متى؟

• من أي جهاز؟

مثلاً:

audit_logs

user_id

terminal_id

action

entity

entity_id

old_value

new_value

created_at

1️⃣8️⃣ CASH REGISTER

──────────────────────────────────────────────────────────────

لكل جهاز/كاشير:

Opening Balance

Sales

Returns

Cash In

Cash Out

Expenses

Closing Balance

مثلاً:

Opening:

20,000 DA

Sales:

150,000 DA

Expenses:

10,000 DA

Expected:

160,000 DA

1️⃣9️⃣ REPORTS

──────────────────────────────────────────────────────────────

أضف:

• Daily Sales

• Monthly Sales

• Profit

• Best Products

• Low Stock

• Cashier Sales

• Terminal Sales

• Store Sales

• Returns

• Expenses

• Purchases

• Inventory Valuation

2️⃣0️⃣ BACKUP

──────────────────────────────────────────────────────────────

PostgreSQL:

Automatic Backup

        ↓

Daily

        ↓

Local Backup

        ↓

Optional Cloud Backup

ويجب وجود:

• Restore

• Backup Verification

• Backup Rotation

2️⃣1️⃣ SERVER HEALTH

──────────────────────────────────────────────────────────────

داخل Electron أظهر:

🟢 Server Online

🔴 Server Offline

🟡 Synchronizing

وأيضاً:

• Last Sync

• Pending Operations

• Server Version

• Database Status

2️⃣2️⃣ SETTINGS

──────────────────────────────────────────────────────────────

Central Settings:

Store Information

Tax

Currency

Invoice Format

Printer

Barcode

Permissions

Receipt

Terminal

Backup

Sync

2️⃣3️⃣ PRINTING

──────────────────────────────────────────────────────────────

أضف دعم:

🧾 Thermal Printer

🖨 A4 Printer

📄 PDF Invoice

🏷 Barcode Printer

ويكون إعداد الطابعة لكل Terminal.

2️⃣4️⃣ BARCODE

──────────────────────────────────────────────────────────────

دعم:

EAN-13

EAN-8

UPC

Code 128

QR Code

ويمكن:

Barcode Scanner

     ↓

Electron

     ↓

Search Product

2️⃣5️⃣ SECURITY

──────────────────────────────────────────────────────────────

• HTTPS

• JWT

• Password Hashing

• RBAC

• Input Validation

• Zod

• Rate Limiting

• SQL Injection Protection

• Secure IPC

• contextIsolation: true

• nodeIntegration: false

• Content Security Policy

2️⃣6️⃣ ELECTRON SECURITY

──────────────────────────────────────────────────────────────

استمر في:

contextIsolation: true

nodeIntegration: false

ولا تجعل Renderer يتصل مباشرة بـ:

❌ PostgreSQL

❌ Filesystem

❌ Node APIs

بل:

React

 ↓

Preload

 ↓

IPC

 ↓

Main Process

2️⃣7️⃣ SERVER NETWORK

──────────────────────────────────────────────────────────────

داخل المحل:

              ROUTER / SWITCH

                     │

              ┌──────┴──────┐

              │             │

           SERVER          POS

              │        ┌────┼────┐

              │        │    │    │

              │       POS1 POS2 POS3

Server IP ثابت:

192.168.1.10

API:

http://192.168.1.10:3000

2️⃣8️⃣ CONFLICT MANAGEMENT

──────────────────────────────────────────────────────────────

إذا حدث:

POS1 → تعديل المنتج

POS2 → تعديل نفس المنتج

يجب أن يكون لديك:

• Version

• Updated At

• Revision

• Conflict Detection

خصوصاً للمخزون.

2️⃣9️⃣ REAL-TIME EVENTS

──────────────────────────────────────────────────────────────

أحداث WebSocket:

product.updated

stock.updated

sale.created

sale.returned

payment.created

user.updated

settings.updated

terminal.connected

terminal.disconnected

3️⃣0️⃣ SOFTWARE UPDATES

──────────────────────────────────────────────────────────────

بما أنه Electron:

Server

 ↓

Version Check

 ↓

Electron Update

 ↓

Download

 ↓

Install

استخدم Auto Update مع إصدارات واضحة.

3️⃣1️⃣ LICENSE SYSTEM

──────────────────────────────────────────────────────────────

بما أنك ستبيع البرنامج:

License

 ├── Store

 ├── Expiration

 ├── Max Terminals

 ├── Features

 └── Plan

مثلاً:

POS BASIC

3 Terminals

POS PRO

10 Terminals

ENTERPRISE

Unlimited

3️⃣2️⃣ ARCHITECTURE النهائية

──────────────────────────────────────────────────────────────

              ┌──────────────────────┐

              │       SERVER         │

              │                      │

              │ Node.js / Fastify    │

              │ PostgreSQL           │

              │ REST API             │

              │ WebSocket            │

              │ Auth / RBAC          │

              │ Backup               │

              └──────────┬───────────┘

                         │

                       LAN

                         │

       ┌─────────────────┼─────────────────┐

       │                 │                 │

       ▼                 ▼                 ▼

   ┌────────┐        ┌────────┐        ┌────────┐

   │ POS 01 │        │ POS 02 │        │ POS 03 │

   │Electron│        │Electron│        │Electron│

   │ React  │        │ React  │        │ React  │

   │ SQLite │        │ SQLite │        │ SQLite │

   └────────┘        └────────┘        └────────┘

                         │

                         ▼

                  ┌──────────────┐

                  │ Cloud Backup │

                  └──────────────┘

3️⃣3️⃣ أهم قاعدة

──────────────────────────────────────────────────────────────

             PostgreSQL = SOURCE OF TRUTH

             SQLite = LOCAL CACHE/OFFLINE

             API = COMMUNICATION

             WebSocket = REAL-TIME

             Electron = CLIENT

             Server = CENTRAL BRAIN

3️⃣4️⃣ لا تفعل هذه الأشياء

──────────────────────────────────────────────────────────────

❌ مشاركة SQLite عبر الشبكة

❌ اتصال Electron مباشر بـ PostgreSQL

❌ تخزين Passwords بشكل صريح

❌ الاعتماد على Auto Increment فقط

❌ تعديل المخزون بدون Movement

❌ حذف المبيعات فعلياً

❌ السماح لكل المستخدمين بكل الصلاحيات

❌ الاعتماد على الإنترنت فقط

❌ وضع Business Logic حساس داخل React

3️⃣5️⃣ النتيجة

──────────────────────────────────────────────────────────────

بدلاً من:

        Electron POS

             ↓

          SQLite

ستحصل على:

             ENTERPRISE POS

       ┌─────────────────────┐

       │      CENTRAL        │

       │       SERVER        │

       │                     │

       │ PostgreSQL          │

       │ API                 │

       │ WebSocket           │

       │ Authentication      │

       │ Inventory           │

       │ Reports             │

       │ Backup              │

       └──────────┬──────────┘

                  │

        ┌─────────┼─────────┐

        │         │         │

       POS1      POS2      POS3

        │         │         │

     SQLite    SQLite    SQLite

        │         │         │

        └─────────┼─────────┘

                  │

               SYNC

       ✅ Multi-Terminal

       ✅ Multi-User

       ✅ Offline

       ✅ Real-Time

       ✅ Central Inventory

       ✅ Central Reports

       ✅ Secure

       ✅ Scalable

       ✅ Backup

       ✅ License System╔════════════════════════════════════════════════════════════╗

║                 🏪 POS — 10 PC + 6 PRICE DISPLAY          ║

╚════════════════════════════════════════════════════════════╝

                         🖥️ SERVER

                    ┌─────────────────┐

                    │ Node.js API     │

                    │ PostgreSQL      │

                    │ WebSocket       │

                    │ Auth / RBAC     │

                    │ Inventory       │

                    │ Reports         │

                    └────────┬────────┘

                             │

                         LAN / Switch

                             │

          ┌──────────────────┼──────────────────┐

          │                  │                  │

          ▼                  ▼                  ▼

      💻 POS 01           💻 POS 02          💻 POS 03

      Electron            Electron            Electron

      SQLite              SQLite              SQLite

          │                  │                  │

          └──────────────────┼──────────────────┘

                             │

                         ... حتى 10

                             │

          ┌──────────────────┼──────────────────┐

          │                  │                  │

          ▼                  ▼                  ▼

      🖥️ Display 01      🖥️ Display 02      🖥️ Display 03

      Price Display      Price Display      Price Display

          │                  │                  │

          └──────────────────┼──────────────────┘

                             │

                         ... حتى 6🟢 POS-01       Online

🟢 POS-02       Online

🟢 POS-03       Online

...

🟢 POS-10       Online

🟢 DISPLAY-01   Online

🟢 DISPLAY-02   Online

...

🔴 DISPLAY-06   Offline because :لدي تطبيق pos مبيعات يعمل ب sqlite اريد بيعه لمحل تجاري كبير لديه server واجهزة كلها متصلة به كيف أوسع التطبيق علما انه مبني ب electron and fix the part of export and import json data it doesn't work و بالنسبة 🏪 المحل

│

├── 💻 POS 01

├── 💻 POS 02

├── 💻 POS 03

├── 💻 POS 04

├── 💻 POS 05

├── 💻 POS 06

├── 💻 POS 07

├── 💻 POS 08

├── 💻 POS 09

├── 💻 POS 10

│

├── 🖥️ Price Display 01

├── 🖥️ Price Display 02

├── 🖥️ Price Display 03

├── 🖥️ Price Display 04

├── 🖥️ Price Display 05

└── 🖥️ Price Display 06

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9cb1606f-b435-409b-9dfa-33bf3fc962a7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
