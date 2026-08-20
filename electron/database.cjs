'use strict';
/**
 * ManagByte — SQLite database layer (Electron main process only).
 * Uses better-sqlite3 (synchronous) for all operations.
 * Tables are fully normalized. JSON used only for arrays (sale.items).
 */

const path = require('path');
const os = require('os');
const crypto = require('crypto');

let db;

/* ─────────────────────────── INIT ─────────────────────────── */

function initDatabase(userDataPath) {
  const Database = require('better-sqlite3');
  const dbPath = path.join(userDataPath, 'managbyte.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  createTables();
  migrateSchema();
  console.log('[DB] SQLite opened at', dbPath);
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      username       TEXT NOT NULL,
      display_name   TEXT,
      email          TEXT,
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL,
      active         INTEGER NOT NULL DEFAULT 1,
      last_login_at  TEXT,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      color       TEXT,
      parent_id   TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      sku         TEXT,
      barcode     TEXT,
      category_id TEXT,
      cost        REAL NOT NULL DEFAULT 0,
      price       REAL NOT NULL DEFAULT 0,
      stock       REAL NOT NULL DEFAULT 0,
      min_stock   REAL NOT NULL DEFAULT 0,
      image       TEXT,
      description TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL,
      sale_type   TEXT NOT NULL DEFAULT 'piece',
      unit        TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT,
      email      TEXT,
      address    TEXT,
      notes      TEXT,
      balance    REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT,
      email      TEXT,
      address    TEXT,
      balance    REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id             TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      customer_id    TEXT,
      customer_name  TEXT,
      items          TEXT NOT NULL,
      subtotal       REAL NOT NULL DEFAULT 0,
      discount       REAL NOT NULL DEFAULT 0,
      tax_pct        REAL NOT NULL DEFAULT 0,
      total          REAL NOT NULL DEFAULT 0,
      payment        TEXT,
      status         TEXT,
      cashier_id     TEXT,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS held_sales (
      id             TEXT PRIMARY KEY,
      invoice_number TEXT,
      customer_id    TEXT,
      customer_name  TEXT,
      items          TEXT NOT NULL,
      subtotal       REAL NOT NULL DEFAULT 0,
      discount       REAL NOT NULL DEFAULT 0,
      tax_pct        REAL NOT NULL DEFAULT 0,
      total          REAL NOT NULL DEFAULT 0,
      payment        TEXT,
      status         TEXT,
      cashier_id     TEXT,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id           TEXT PRIMARY KEY,
      product_id   TEXT,
      product_name TEXT,
      type         TEXT,
      quantity     REAL NOT NULL DEFAULT 0,
      before_stock REAL NOT NULL DEFAULT 0,
      after_stock  REAL NOT NULL DEFAULT 0,
      reason       TEXT,
      user_id      TEXT,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY,
      type        TEXT,
      description TEXT,
      amount      REAL NOT NULL DEFAULT 0,
      reference   TEXT,
      product_id  TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id         TEXT PRIMARY KEY,
      user_id    TEXT,
      user_name  TEXT,
      action     TEXT,
      entity     TEXT,
      entity_id  TEXT,
      details    TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

/* ─────────────────────────── MIGRATIONS ─────────────────────────── */

function migrateSchema() {
  // Add sale_type and unit columns to products if they don't exist (v2 migration)
  const cols = db.prepare(`PRAGMA table_info(products)`).all().map((r) => r.name);
  if (!cols.includes('sale_type')) {
    db.exec(`ALTER TABLE products ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'piece'`);
    console.log('[DB] Migrated: added sale_type column to products');
  }
  if (!cols.includes('unit')) {
    db.exec(`ALTER TABLE products ADD COLUMN unit TEXT`);
    console.log('[DB] Migrated: added unit column to products');
  }
}

/* ─────────────────────────── META ─────────────────────────── */

const getMeta = (key) => {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
};
const setMeta = (key, value) => {
  if (value === null || value === undefined) {
    db.prepare('DELETE FROM meta WHERE key = ?').run(key);
  } else {
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
  }
};

/* ─────────────────────────── ROW MAPPERS ─────────────────────────── */

const rowToUser = (r) => ({
  id: r.id, username: r.username, displayName: r.display_name, email: r.email || '',
  passwordHash: r.password_hash, role: r.role, active: r.active === 1,
  lastLoginAt: r.last_login_at || undefined, createdAt: r.created_at,
});
const userToRow = (u) => ({
  id: u.id, username: u.username, display_name: u.displayName, email: u.email || null,
  password_hash: u.passwordHash, role: u.role, active: u.active ? 1 : 0,
  last_login_at: u.lastLoginAt || null, created_at: u.createdAt,
});

const rowToCategory = (r) => ({
  id: r.id, name: r.name, description: r.description || undefined, color: r.color,
  parentId: r.parent_id || undefined, active: r.active === 1, createdAt: r.created_at,
});
const categoryToRow = (c) => ({
  id: c.id, name: c.name, description: c.description || null, color: c.color,
  parent_id: c.parentId || null, active: c.active ? 1 : 0, created_at: c.createdAt,
});

const rowToProduct = (r) => ({
  id: r.id, name: r.name, sku: r.sku || '', barcode: r.barcode || undefined,
  categoryId: r.category_id || undefined, cost: r.cost, price: r.price,
  stock: r.stock, minStock: r.min_stock, image: r.image || undefined,
  description: r.description || undefined, active: r.active === 1, createdAt: r.created_at,
  saleType: r.sale_type || 'piece', unit: r.unit || undefined,
});
const productToRow = (p) => ({
  id: p.id, name: p.name, sku: p.sku || null, barcode: p.barcode || null,
  category_id: p.categoryId || null, cost: p.cost, price: p.price,
  stock: p.stock, min_stock: p.minStock, image: p.image || null,
  description: p.description || null, active: p.active ? 1 : 0, created_at: p.createdAt,
  sale_type: p.saleType || 'piece', unit: p.unit || null,
});

const rowToCustomer = (r) => ({
  id: r.id, name: r.name, phone: r.phone || undefined, email: r.email || undefined,
  address: r.address || undefined, notes: r.notes || undefined,
  balance: r.balance, createdAt: r.created_at,
});
const customerToRow = (c) => ({
  id: c.id, name: c.name, phone: c.phone || null, email: c.email || null,
  address: c.address || null, notes: c.notes || null, balance: c.balance, created_at: c.createdAt,
});

const rowToSupplier = (r) => ({
  id: r.id, name: r.name, phone: r.phone || undefined, email: r.email || undefined,
  address: r.address || undefined, balance: r.balance, createdAt: r.created_at,
});
const supplierToRow = (s) => ({
  id: s.id, name: s.name, phone: s.phone || null, email: s.email || null,
  address: s.address || null, balance: s.balance, created_at: s.createdAt,
});

const rowToSale = (r) => ({
  id: r.id, invoiceNumber: r.invoice_number, customerId: r.customer_id || undefined,
  customerName: r.customer_name || '', items: JSON.parse(r.items || '[]'),
  subtotal: r.subtotal, discount: r.discount, taxPct: r.tax_pct, total: r.total,
  payment: r.payment, status: r.status, cashierId: r.cashier_id, createdAt: r.created_at,
});
const saleToRow = (s) => ({
  id: s.id, invoice_number: s.invoiceNumber, customer_id: s.customerId || null,
  customer_name: s.customerName, items: JSON.stringify(s.items || []),
  subtotal: s.subtotal, discount: s.discount, tax_pct: s.taxPct, total: s.total,
  payment: s.payment, status: s.status, cashier_id: s.cashierId, created_at: s.createdAt,
});

const rowToMovement = (r) => ({
  id: r.id, productId: r.product_id, productName: r.product_name, type: r.type,
  quantity: r.quantity, before: r.before_stock, after: r.after_stock,
  reason: r.reason || undefined, userId: r.user_id, createdAt: r.created_at,
});
const movementToRow = (m) => ({
  id: m.id, product_id: m.productId, product_name: m.productName, type: m.type,
  quantity: m.quantity, before_stock: m.before, after_stock: m.after,
  reason: m.reason || null, user_id: m.userId, created_at: m.createdAt,
});

const rowToExpense = (r) => ({
  id: r.id, type: r.type, description: r.description, amount: r.amount,
  reference: r.reference || undefined, productId: r.product_id || undefined, createdAt: r.created_at,
});
const expenseToRow = (e) => ({
  id: e.id, type: e.type, description: e.description, amount: e.amount,
  reference: e.reference || null, product_id: e.productId || null, created_at: e.createdAt,
});

const rowToAudit = (r) => ({
  id: r.id, userId: r.user_id, userName: r.user_name, action: r.action,
  entity: r.entity, entityId: r.entity_id || undefined, details: r.details || undefined,
  createdAt: r.created_at,
});
const auditToRow = (a) => ({
  id: a.id, user_id: a.userId, user_name: a.userName, action: a.action,
  entity: a.entity, entity_id: a.entityId || null, details: a.details || null,
  created_at: a.createdAt,
});

/* ─────────────────────────── SETTINGS / LICENSE / SESSION ─────────────────────────── */

const DEFAULT_SETTINGS = {
  name: 'LogixStore', currency: 'DZD', language: 'ar', taxPct: 0,
  printerSize: '80mm', theme: 'light', timezone: 'Africa/Algiers',
};

function getSettings() {
  const v = getMeta('settings');
  return v ? { ...DEFAULT_SETTINGS, ...JSON.parse(v) } : { ...DEFAULT_SETTINGS };
}
function setSettingsHandler(patch) {
  const current = getSettings();
  setMeta('settings', JSON.stringify({ ...current, ...patch }));
}

function getLicense() {
  const v = getMeta('license');
  return v ? JSON.parse(v) : null;
}
function setLicenseHandler(license) {
  setMeta('license', license ? JSON.stringify(license) : null);
}

function getSession() {
  const v = getMeta('session');
  return v ? JSON.parse(v) : null;
}
function setSessionHandler(session) {
  setMeta('session', session ? JSON.stringify(session) : null);
}

/* ─────────────────────────── GETSTATE (full load) ─────────────────────────── */

function getState() {
  return {
    users:          db.prepare('SELECT * FROM users').all().map(rowToUser),
    categories:     db.prepare('SELECT * FROM categories').all().map(rowToCategory),
    products:       db.prepare('SELECT * FROM products').all().map(rowToProduct),
    customers:      db.prepare('SELECT * FROM customers').all().map(rowToCustomer),
    suppliers:      db.prepare('SELECT * FROM suppliers').all().map(rowToSupplier),
    sales:          db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all().map(rowToSale),
    heldSales:      db.prepare('SELECT * FROM held_sales').all().map(rowToSale),
    movements:      db.prepare('SELECT * FROM stock_movements ORDER BY created_at DESC').all().map(rowToMovement),
    expenses:       db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all().map(rowToExpense),
    auditLogs:      db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5000').all().map(rowToAudit),
    settings:       getSettings(),
    license:        getLicense(),
    session:        getSession(),
    seeded:         getMeta('seeded') === '1',
    setupCompleted: getMeta('setupCompleted') === '1',
  };
}

/* ─────────────────────────── UPSERT HELPERS ─────────────────────────── */

const upsertUser = (u) => {
  db.prepare(`INSERT OR REPLACE INTO users
    (id,username,display_name,email,password_hash,role,active,last_login_at,created_at)
    VALUES (@id,@username,@display_name,@email,@password_hash,@role,@active,@last_login_at,@created_at)
  `).run(userToRow(u));
};

const upsertCategory = (c) => {
  db.prepare(`INSERT OR REPLACE INTO categories
    (id,name,description,color,parent_id,active,created_at)
    VALUES (@id,@name,@description,@color,@parent_id,@active,@created_at)
  `).run(categoryToRow(c));
};

const upsertProduct = (p) => {
  db.prepare(`INSERT OR REPLACE INTO products
    (id,name,sku,barcode,category_id,cost,price,stock,min_stock,image,description,active,created_at,sale_type,unit)
    VALUES (@id,@name,@sku,@barcode,@category_id,@cost,@price,@stock,@min_stock,@image,@description,@active,@created_at,@sale_type,@unit)
  `).run(productToRow(p));
};

const upsertCustomer = (c) => {
  db.prepare(`INSERT OR REPLACE INTO customers
    (id,name,phone,email,address,notes,balance,created_at)
    VALUES (@id,@name,@phone,@email,@address,@notes,@balance,@created_at)
  `).run(customerToRow(c));
};

const upsertSupplier = (s) => {
  db.prepare(`INSERT OR REPLACE INTO suppliers
    (id,name,phone,email,address,balance,created_at)
    VALUES (@id,@name,@phone,@email,@address,@balance,@created_at)
  `).run(supplierToRow(s));
};

const upsertSale = (table, s) => {
  db.prepare(`INSERT OR REPLACE INTO ${table}
    (id,invoice_number,customer_id,customer_name,items,subtotal,discount,tax_pct,total,payment,status,cashier_id,created_at)
    VALUES (@id,@invoice_number,@customer_id,@customer_name,@items,@subtotal,@discount,@tax_pct,@total,@payment,@status,@cashier_id,@created_at)
  `).run(saleToRow(s));
};

/* ─────────────────────────── TRANSACTIONS ─────────────────────────── */

// addSaleWithMovements: atomic — inserts sale, updates products, records movements
function addSaleWithMovements({ sale, updatedProducts, movements }) {
  const txn = db.transaction(() => {
    upsertSale('sales', sale);
    for (const p of (updatedProducts || [])) upsertProduct(p);
    for (const m of (movements || [])) {
      db.prepare(`INSERT OR REPLACE INTO stock_movements
        (id,product_id,product_name,type,quantity,before_stock,after_stock,reason,user_id,created_at)
        VALUES (@id,@product_id,@product_name,@type,@quantity,@before_stock,@after_stock,@reason,@user_id,@created_at)
      `).run(movementToRow(m));
    }
  });
  txn();
}

/* ─────────────────────────── MACHINE ID ─────────────────────────── */

function getMachineId() {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    (os.cpus()[0] || {}).model || '',
    String(os.totalmem()),
  ];
  return crypto.createHash('sha256').update(parts.join('||')).digest('hex').slice(0, 16).toUpperCase();
}

/* ─────────────────────────── EXPORT HANDLERS ─────────────────────────── */

function getDbHandlers() {
  return {
    // Synchronous (via ipcMain.on + event.returnValue)
    sync: {
      'db:getStateSync': getState,
    },
    // Async (via ipcMain.handle)
    async: {
      'db:getState':              getState,

      'db:upsertUser':            (u)  => upsertUser(u),
      'db:removeUser':            (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id),
      'db:setUsers':              (users) => {
        const txn = db.transaction(() => {
          db.prepare('DELETE FROM users').run();
          for (const u of users) upsertUser(u);
        });
        txn();
      },

      'db:upsertCategory':        (c)  => upsertCategory(c),
      'db:removeCategory':        (id) => db.prepare('DELETE FROM categories WHERE id = ?').run(id),

      'db:upsertProduct':         (p)  => upsertProduct(p),
      'db:removeProduct':         (id) => db.prepare('DELETE FROM products WHERE id = ?').run(id),

      'db:upsertCustomer':        (c)  => upsertCustomer(c),
      'db:removeCustomer':        (id) => db.prepare('DELETE FROM customers WHERE id = ?').run(id),

      'db:upsertSupplier':        (s)  => upsertSupplier(s),
      'db:removeSupplier':        (id) => db.prepare('DELETE FROM suppliers WHERE id = ?').run(id),

      'db:addSaleWithMovements':  (payload) => addSaleWithMovements(payload),
      'db:updateSale':            (s)  => upsertSale('sales', s),
      'db:holdSale':              (s)  => upsertSale('held_sales', s),
      'db:releaseHeld':           (id) => {
        const row = db.prepare('SELECT * FROM held_sales WHERE id = ?').get(id);
        db.prepare('DELETE FROM held_sales WHERE id = ?').run(id);
        return row ? rowToSale(row) : null;
      },

      'db:addMovement':           (m)  => {
        db.prepare(`INSERT OR REPLACE INTO stock_movements
          (id,product_id,product_name,type,quantity,before_stock,after_stock,reason,user_id,created_at)
          VALUES (@id,@product_id,@product_name,@type,@quantity,@before_stock,@after_stock,@reason,@user_id,@created_at)
        `).run(movementToRow(m));
      },

      'db:addExpense':            (e)  => {
        db.prepare(`INSERT OR REPLACE INTO expenses
          (id,type,description,amount,reference,product_id,created_at)
          VALUES (@id,@type,@description,@amount,@reference,@product_id,@created_at)
        `).run(expenseToRow(e));
      },
      'db:removeExpense':         (id) => db.prepare('DELETE FROM expenses WHERE id = ?').run(id),

      'db:setLicense':            (l)  => setLicenseHandler(l),
      'db:setSettings':           (p)  => setSettingsHandler(p),
      'db:setSession':            (s)  => setSessionHandler(s),

      'db:addAudit':              (a)  => {
        db.prepare(`INSERT OR REPLACE INTO audit_logs
          (id,user_id,user_name,action,entity,entity_id,details,created_at)
          VALUES (@id,@user_id,@user_name,@action,@entity,@entity_id,@details,@created_at)
        `).run(auditToRow(a));
        // Keep audit_logs table trimmed to 5000 rows
        db.prepare(`DELETE FROM audit_logs WHERE id NOT IN
          (SELECT id FROM audit_logs ORDER BY created_at DESC LIMIT 5000)
        `).run();
      },

      'db:markSeeded':            ()   => setMeta('seeded', '1'),

      /* ── Sauvegarde / Restauration ── */
      'db:exportState':           ()   => getState(),
      'db:importState':           (state) => importState(state),
      'db:markSetupCompleted':    ()   => setMeta('setupCompleted', '1'),
      'db:resetAll':              ()   => {
        const txn = db.transaction(() => {
          ['users','categories','products','customers','suppliers',
           'sales','held_sales','stock_movements','expenses','audit_logs','meta'
          ].forEach(t => db.prepare(`DELETE FROM ${t}`).run());
        });
        txn();
      },
    },
  };
}

/* ─────────────────────────── IMPORT (restauration complète) ─────────────────────────── */

function importState(state) {
  if (!state || typeof state !== 'object') throw new Error('Sauvegarde invalide');
  const txn = db.transaction(() => {
    ['users','categories','products','customers','suppliers',
     'sales','held_sales','stock_movements','expenses','audit_logs',
    ].forEach((t) => db.prepare(`DELETE FROM ${t}`).run());

    for (const u of state.users     || []) upsertUser(u);
    for (const c of state.categories|| []) upsertCategory(c);
    for (const p of state.products  || []) upsertProduct(p);
    for (const c of state.customers || []) upsertCustomer(c);
    for (const s of state.suppliers || []) upsertSupplier(s);
    for (const s of state.sales     || []) upsertSale('sales', s);
    for (const s of state.heldSales || []) upsertSale('held_sales', s);
    for (const m of state.movements || []) {
      db.prepare(`INSERT OR REPLACE INTO stock_movements
        (id,product_id,product_name,type,quantity,before_stock,after_stock,reason,user_id,created_at)
        VALUES (@id,@product_id,@product_name,@type,@quantity,@before_stock,@after_stock,@reason,@user_id,@created_at)
      `).run(movementToRow(m));
    }
    for (const e of state.expenses  || []) {
      db.prepare(`INSERT OR REPLACE INTO expenses
        (id,type,description,amount,reference,product_id,created_at)
        VALUES (@id,@type,@description,@amount,@reference,@product_id,@created_at)
      `).run(expenseToRow(e));
    }
    for (const a of state.auditLogs || []) {
      db.prepare(`INSERT OR REPLACE INTO audit_logs
        (id,user_id,user_name,action,entity,entity_id,details,created_at)
        VALUES (@id,@user_id,@user_name,@action,@entity,@entity_id,@details,@created_at)
      `).run(auditToRow(a));
    }

    if (state.settings) setMeta('settings', JSON.stringify(state.settings));
    setMeta('license', state.license ? JSON.stringify(state.license) : null);
    setMeta('seeded', state.seeded ? '1' : '0');
    setMeta('setupCompleted', state.setupCompleted ? '1' : '0');
  });
  txn();
  return true;
}

module.exports = { initDatabase, getDbHandlers, getMachineId };