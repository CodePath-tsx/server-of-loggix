'use strict';
/**
 * LogixStore ERP — Electron preload script.
 * Exposes window.electronAPI to the renderer via contextBridge.
 * All DB mutations are async (ipcRenderer.invoke).
 * Initial state load is sync (ipcRenderer.sendSync) to avoid init flash.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke   = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
const sendSync = (ch, ...a) => ipcRenderer.sendSync(ch, ...a);

contextBridge.exposeInMainWorld('electronAPI', {
  /** Marker — lets renderer detect Electron environment */
  isElectron: true,

  /* ── Synchronous init (zero-flash startup) ── */
  getStateSync:     ()    => sendSync('db:getStateSync'),
  getMachineIdSync: ()    => sendSync('app:getMachineIdSync'),

  /* ── Users ── */
  upsertUser:       (u)   => invoke('db:upsertUser', u),
  removeUser:       (id)  => invoke('db:removeUser', id),
  setUsers:         (arr) => invoke('db:setUsers', arr),

  /* ── Categories ── */
  upsertCategory:   (c)   => invoke('db:upsertCategory', c),
  removeCategory:   (id)  => invoke('db:removeCategory', id),

  /* ── Products ── */
  upsertProduct:    (p)   => invoke('db:upsertProduct', p),
  removeProduct:    (id)  => invoke('db:removeProduct', id),

  /* ── Customers ── */
  upsertCustomer:   (c)   => invoke('db:upsertCustomer', c),
  removeCustomer:   (id)  => invoke('db:removeCustomer', id),

  /* ── Suppliers ── */
  upsertSupplier:   (s)   => invoke('db:upsertSupplier', s),
  removeSupplier:   (id)  => invoke('db:removeSupplier', id),

  /* ── Sales (atomic: sale + stock deduction + movements in one SQL transaction) ── */
  addSaleWithMovements: (payload) => invoke('db:addSaleWithMovements', payload),
  updateSale:           (s)       => invoke('db:updateSale', s),
  holdSale:             (s)       => invoke('db:holdSale', s),
  releaseHeld:          (id)      => invoke('db:releaseHeld', id),

  /* ── Inventory ── */
  addMovement:      (m)   => invoke('db:addMovement', m),

  /* ── Expenses ── */
  addExpense:       (e)   => invoke('db:addExpense', e),
  removeExpense:    (id)  => invoke('db:removeExpense', id),

  /* ── License & Settings ── */
  setLicense:       (l)   => invoke('db:setLicense', l),
  setSettings:      (p)   => invoke('db:setSettings', p),

  /* ── Auth session ── */
  setSession:       (s)   => invoke('db:setSession', s),

  /* ── Audit ── */
  addAudit:         (a)   => invoke('db:addAudit', a),

  /* ── Meta ── */
  markSeeded:          ()  => invoke('db:markSeeded'),
  markSetupCompleted:  ()  => invoke('db:markSetupCompleted'),
  resetAll:            ()  => invoke('db:resetAll'),

  /* ── Sauvegarde / Restauration ── */
  exportState:      ()   => invoke('db:exportState'),
  importState:      (st) => invoke('db:importState', st),
  saveBackupFile:   (json, name) => invoke('backup:save', json, name),
  openBackupFile:   ()   => invoke('backup:open'),

  /* ── App ── */
  getVersion:          ()  => invoke('app:getVersion'),

  /* ── License verification (Node.js crypto — Ed25519 reliable) ── */
  verifyLicenseKey: (licenseString, machineId) =>
    invoke('license:verify', licenseString, machineId),
});
