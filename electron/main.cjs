'use strict';
/**
 * LogixStore ERP — Electron main process.
 * Dev mode  : loads http://localhost:5000 (Vite dev server must be running)
 * Prod mode : loads dist/index.html (built with `bun run electron:build`)
 */

const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createPublicKey, verify: cryptoVerify } = require('node:crypto');
const { initDatabase, getDbHandlers, getMachineId } = require('./database.cjs');

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5000';

let mainWindow = null;

/* ─── Window ─── */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'LogixStore ERP',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: !isDev,
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus(); // Force keyboard focus to this window on Windows
  });

  // Allow blank popup windows for printing, open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === '' || url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 900,
          height: 1000,
          title: 'LogixStore — Impression',
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false },
        },
      };
    }
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ─── IPC registration ─── */
function registerIpc() {
  const handlers = getDbHandlers();

  // Async handlers (mutations)
  for (const [channel, handler] of Object.entries(handlers.async)) {
    ipcMain.handle(channel, (_event, ...args) => handler(...args));
  }

  // Sync handlers (initial state load — uses sendSync for zero-flash init)
  for (const [channel, handler] of Object.entries(handlers.sync)) {
    ipcMain.on(channel, (event, ...args) => {
      try {
        event.returnValue = handler(...args);
      } catch (err) {
        console.error('[IPC sync error]', channel, err);
        event.returnValue = null;
      }
    });
  }

  // App info
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // Sauvegarde : écriture du fichier JSON via boîte de dialogue native
  ipcMain.handle('backup:save', async (_event, json, suggestedName) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Enregistrer la sauvegarde',
      defaultPath: suggestedName || `logixstore-backup-${Date.now()}.json`,
      filters: [{ name: 'Sauvegarde JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(filePath, json, 'utf8');
    return { ok: true, path: filePath };
  });

  // Restauration : lecture d'un fichier JSON via boîte de dialogue native
  ipcMain.handle('backup:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choisir une sauvegarde',
      properties: ['openFile'],
      filters: [{ name: 'Sauvegarde JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };
    const content = await fs.promises.readFile(filePaths[0], 'utf8');
    return { ok: true, path: filePaths[0], json: content };
  });
  ipcMain.on('app:getMachineIdSync', (event) => {
    event.returnValue = getMachineId();
  });

  // License verification via Node.js crypto (Ed25519 — fully supported).
  // Public key is HARDCODED here — never accepted from renderer (trust boundary).
  const VENDOR_PUBLIC_KEY_B64URL =
    'MCowBQYDK2VwAyEAYsdoBtBTbCmncDg5imOvExikCT--DVsR6gqMWjcWnTA';

  ipcMain.handle('license:verify', (_event, licenseString, machineId) => {
    try {
      if (typeof licenseString !== 'string' || !licenseString.startsWith('MB1.')) {
        return { ok: false, error: 'Format de clé de licence invalide' };
      }
      if (typeof machineId !== 'string' || machineId.length === 0) {
        return { ok: false, error: 'Identifiant de l\'appareil manquant' };
      }

      const parts = licenseString.slice(4).split('.');
      if (parts.length !== 2) return { ok: false, error: 'Clé de licence corrompue' };

      const [payloadB64, sigB64] = parts;
      const b64urlToBuffer = (s) => {
        const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
        return Buffer.from((s + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      };

      const payloadBytes = b64urlToBuffer(payloadB64);
      const sigBytes     = b64urlToBuffer(sigB64);

      // Verify against the hardcoded vendor public key only
      const spkiDer = b64urlToBuffer(VENDOR_PUBLIC_KEY_B64URL);
      const pubKey  = createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
      const isValid = cryptoVerify(null, payloadBytes, pubKey, sigBytes);
      if (!isValid) return { ok: false, error: 'Signature de licence invalide - peut être falsifiée' };

      let payload;
      try {
        payload = JSON.parse(payloadBytes.toString('utf8'));
      } catch {
        return { ok: false, error: 'Contenu de la licence illisible' };
      }

      if (payload.machineId !== '*' && payload.machineId !== machineId) {
        return { ok: false, error: 'Cette licence est liée à un autre appareil' };
      }

      // Strict expiry: reject missing/NaN dates on non-lifetime licenses
      if (payload.expiresAt !== undefined) {
        const exp = new Date(payload.expiresAt).getTime();
        if (!Number.isFinite(exp)) return { ok: false, error: 'Date d\'expiration de la licence invalide' };
        if (exp < Date.now())       return { ok: false, error: 'La licence a expiré' };
      }

      return { ok: true, payload };
    } catch (e) {
      // Log internally; return stable message to renderer
      console.error('[license:verify]', e);
      return { ok: false, error: 'Échec de la vérification de la licence' };
    }
  });
}

/* ─── App lifecycle ─── */
app.whenReady().then(() => {
  // Remove default menu in production
  if (!isDev) Menu.setApplicationMenu(null);

  initDatabase(app.getPath('userData'));
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
