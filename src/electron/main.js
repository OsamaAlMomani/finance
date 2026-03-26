import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { initDatabase, switchDatabase } from '../services/databaseService.js';
import { registerIpcHandlers } from './ipcHandlers.js';
import {
  clearUserCredential,
  saveUserCredential,
  verifyUserCredential
} from './credentialStore.js';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, ipcMain, Menu, globalShortcut, dialog } = require('electron');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const isSmokeMode = process.argv.includes('--smoke-ipc');
const isBrokenPipeError = (error) => error?.code === 'EPIPE' || error?.code === 'ERR_STREAM_DESTROYED';

const guardProcessStream = (stream) => {
  if (!stream?.on) return;
  stream.on('error', (error) => {
    if (isBrokenPipeError(error)) return;
  });
};

guardProcessStream(process.stdout);
guardProcessStream(process.stderr);

let mainWindow;
let menuVisible = true;
let appMenu = null;
let webDiagnosticsAttached = false;
const DEV_SERVER_URL = 'http://localhost:5173';
const WINDOW_BACKGROUND_COLOR = '#f6f9ff';
const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === '1';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDevServer = async (url, timeoutMs = 25000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return true;
    } catch (_error) {
      // Dev server is not ready yet.
    }
    await wait(400);
  }
  return false;
};

const shouldLogResourceIssue = (url) => {
  const target = String(url || '');
  if (!target) return false;
  if (target.startsWith('devtools://')) return false;
  if (target.startsWith('chrome-extension://')) return false;
  return true;
};

const attachWebDiagnostics = (webContents) => {
  if (webDiagnosticsAttached) return;
  const session = webContents?.session;
  if (!session?.webRequest) return;

  webDiagnosticsAttached = true;

  session.webRequest.onErrorOccurred((details) => {
    if (!shouldLogResourceIssue(details.url)) return;
    if (details.error === 'net::ERR_ABORTED') return;
    console.warn(`[web-resource-error] ${details.error} (${details.resourceType}) ${details.url}`);
  });

  session.webRequest.onCompleted((details) => {
    if (!shouldLogResourceIssue(details.url)) return;
    if (Number(details.statusCode) >= 400) {
      console.warn(`[web-resource-http] ${details.statusCode} (${details.resourceType}) ${details.url}`);
    }
  });
};

const ensureSessionDataPath = () => {
  try {
    const sessionPath = path.join(app.getPath('userData'), 'session-data');
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    app.setPath('sessionData', sessionPath);
  } catch (error) {
    console.warn('Unable to set custom sessionData path:', error?.message || error);
  }
};

const createAppMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'close' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Test',
      submenu: [
        {
          label: 'Run Tests',
          accelerator: 'Ctrl+Shift+T',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('app:run-tests');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('app:show-about');
          }
        }
      ]
    }
  ];

  appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);
  menuVisible = true;
};

const toggleMenuVisibility = () => {
  if (menuVisible) {
    Menu.setApplicationMenu(null);
    menuVisible = false;
  } else {
    Menu.setApplicationMenu(appMenu);
    menuVisible = true;
  }
};

const getUsersFilePath = () => path.join(app.getPath('userData'), 'users.json');
const getUsersDir = () => path.join(app.getPath('userData'), 'users');

const ensureUsersDir = () => {
  const dir = getUsersDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const loadUsers = () => {
  const file = getUsersFilePath();
  if (!fs.existsSync(file)) return { activeUserId: null, users: [] };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return { activeUserId: null, users: [] };
  }
};

const saveUsers = (data) => {
  fs.writeFileSync(getUsersFilePath(), JSON.stringify(data, null, 2));
};

const ensureUserDir = (userId) => {
  ensureUsersDir();
  const dir = path.join(getUsersDir(), userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const getProfileDbPath = (userId, profileId) => {
  const dir = ensureUserDir(userId);
  return path.join(dir, `${profileId}.db`);
};

const hasLabProfile = (user) => (user?.profiles || []).some((profile) => Boolean(profile?.isLab));

const getRendererIndexPath = () => {
  const candidates = [
    path.join(__dirname, '../../react-dist/index.html'),
    path.join(__dirname, '../../dist/index.html')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
};

const getBootHtml = (isDevelopment) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Finance</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", Tahoma, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(14, 165, 233, 0.16), transparent 32%),
          radial-gradient(circle at top right, rgba(99, 102, 241, 0.14), transparent 34%),
          linear-gradient(180deg, #f9fbff 0%, #eef3ff 100%);
        color: #10213a;
      }

      .boot-shell {
        width: min(30rem, calc(100vw - 3rem));
        padding: 1.4rem 1.5rem;
        border-radius: 1.5rem;
        border: 1px solid rgba(214, 222, 236, 0.95);
        background: rgba(255, 255, 255, 0.92);
        box-shadow:
          0 18px 42px -26px rgba(15, 23, 42, 0.45),
          0 12px 24px -18px rgba(37, 99, 235, 0.28);
        backdrop-filter: blur(10px);
      }

      .boot-row {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }

      .boot-mark {
        width: 2.8rem;
        height: 2.8rem;
        border-radius: 1rem;
        background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
        box-shadow: 0 10px 24px -14px rgba(37, 99, 235, 0.7);
      }

      .boot-copy strong {
        display: block;
        font-size: 1rem;
        font-weight: 700;
      }

      .boot-copy span {
        display: block;
        margin-top: 0.2rem;
        color: #64748b;
        font-size: 0.92rem;
      }

      .boot-bar {
        margin-top: 1rem;
        height: 0.45rem;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.22);
      }

      .boot-bar::after {
        content: "";
        display: block;
        width: 38%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2563eb 0%, #38bdf8 100%);
        animation: boot-slide 1.2s ease-in-out infinite;
      }

      @keyframes boot-slide {
        0% { transform: translateX(-110%); }
        60% { transform: translateX(185%); }
        100% { transform: translateX(185%); }
      }
    </style>
  </head>
  <body>
    <div class="boot-shell">
      <div class="boot-row">
        <div class="boot-mark" aria-hidden="true"></div>
        <div class="boot-copy">
          <strong>Finance</strong>
          <span>${isDevelopment ? 'Starting workspace and syncing the local dashboard...' : 'Loading your local workspace...'}</span>
        </div>
      </div>
      <div class="boot-bar" aria-hidden="true"></div>
    </div>
  </body>
</html>
`;

const loadBootScreen = async (browserWindow) => {
  const html = getBootHtml(isDev);
  await browserWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
};

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: WINDOW_BACKGROUND_COLOR,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false 
    },
    title: 'Stock Tracker'
  });
  attachWebDiagnostics(mainWindow.webContents);
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  await loadBootScreen(mainWindow);

  if (isDev) {
    const devServerReady = await waitForDevServer(DEV_SERVER_URL);
    if (devServerReady) {
      await mainWindow.loadURL(DEV_SERVER_URL);
    } else {
      console.warn(`[DEV] Vite server is unavailable at ${DEV_SERVER_URL}. Falling back to built UI (minified stack traces).`);
      await mainWindow.loadFile(getRendererIndexPath());
    }

    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    await mainWindow.loadFile(getRendererIndexPath());
  }
}

app.whenReady().then(async () => {
  ensureSessionDataPath();

  // Initialize Database (per-user, per-profile)
  const usersData = loadUsers();
  let { activeUserId, users } = usersData;
  if (!activeUserId) {
    const defaultProfile = { id: crypto.randomUUID(), name: 'Default Profile', created_at: new Date().toISOString(), isLab: false };
    const defaultUser = {
      id: crypto.randomUUID(),
      name: 'Default',
      created_at: new Date().toISOString(),
      activeProfileId: defaultProfile.id,
      profiles: [defaultProfile]
    };
    users = [defaultUser];
    activeUserId = defaultUser.id;
    saveUsers({ activeUserId, users });
  }

  const activeUser = users.find(u => u.id === activeUserId) || users[0];
  if (activeUser && (!activeUser.profiles || activeUser.profiles.length === 0)) {
    const defaultProfile = { id: crypto.randomUUID(), name: 'Default Profile', created_at: new Date().toISOString(), isLab: false };
    activeUser.profiles = [defaultProfile];
    activeUser.activeProfileId = defaultProfile.id;
    saveUsers({ activeUserId: activeUser.id, users });
  }

  const activeProfileId = activeUser?.activeProfileId || activeUser?.profiles?.[0]?.id;
  const dbPath = getProfileDbPath(activeUser.id, activeProfileId);
  console.log('Initializing database at:', dbPath);
  try {
    initDatabase(dbPath);
    registerIpcHandlers(ipcMain);
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }

  if (isSmokeMode) {
    console.log('[SMOKE] Electron main process booted.');
    console.log('[SMOKE] IPC handlers registered.');
    app.quit();
    return;
  }

  await createWindow();
  createAppMenu();

  globalShortcut.register('Ctrl+Shift+M', () => {
    toggleMenuVisibility();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

ipcMain.handle('user-get-all', () => {
  return loadUsers();
});

ipcMain.handle('user-create', (e, name, avatar) => {
  const data = loadUsers();
  const defaultProfile = { id: crypto.randomUUID(), name: 'Default Profile', created_at: new Date().toISOString(), isLab: false };
  const newUser = {
    id: crypto.randomUUID(),
    name: name || 'User',
    avatar: avatar || null,
    created_at: new Date().toISOString(),
    activeProfileId: defaultProfile.id,
    profiles: [defaultProfile]
  };
  data.users = [...(data.users || []), newUser];
  if (!data.activeUserId) data.activeUserId = newUser.id;
  saveUsers(data);
  return data;
});

ipcMain.handle('user-set-active', (e, userId) => {
  const data = loadUsers();
  if (!data.users?.some(u => u.id === userId)) {
    throw new Error('User not found');
  }
  data.activeUserId = userId;
  saveUsers(data);
  const user = data.users.find(u => u.id === userId);
  const profileId = user?.activeProfileId || user?.profiles?.[0]?.id;
  const dbPath = getProfileDbPath(userId, profileId);
  switchDatabase(dbPath);
  return data;
});

ipcMain.handle('auth-store-credential', async (_event, userId, secret) => {
  return saveUserCredential(userId, secret);
});

ipcMain.handle('auth-verify-credential', async (_event, userId, secret) => {
  return verifyUserCredential(userId, secret);
});

ipcMain.handle('auth-clear-credential', (_event, userId) => {
  return clearUserCredential(userId);
});

ipcMain.handle('profile-create', (e, userId, name, avatar, options = {}) => {
  const data = loadUsers();
  const user = data.users?.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  const isLab = Boolean(options?.isLab);
  if (isLab && hasLabProfile(user)) {
    throw new Error('Lab profile already exists for this user');
  }
  const resolvedName = (name || '').trim() || (isLab ? 'Design Lab' : 'Profile');
  const newProfile = {
    id: crypto.randomUUID(),
    name: resolvedName,
    created_at: new Date().toISOString(),
    avatar: avatar || null,
    isLab
  };
  user.profiles = [...(user.profiles || []), newProfile];
  if (!user.activeProfileId) user.activeProfileId = newProfile.id;
  saveUsers(data);
  return data;
});

ipcMain.handle('user-update-avatar', (e, userId, avatar) => {
  const data = loadUsers();
  const user = data.users?.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  user.avatar = avatar || null;
  saveUsers(data);
  return data;
});

ipcMain.handle('profile-update-avatar', (e, userId, profileId, avatar) => {
  const data = loadUsers();
  const user = data.users?.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  const profile = user.profiles?.find(p => p.id === profileId);
  if (!profile) throw new Error('Profile not found');
  profile.avatar = avatar || null;
  saveUsers(data);
  return data;
});

ipcMain.handle('profile-set-active', (e, userId, profileId) => {
  const data = loadUsers();
  const user = data.users?.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  if (!user.profiles?.some(p => p.id === profileId)) throw new Error('Profile not found');
  user.activeProfileId = profileId;
  saveUsers(data);
  const dbPath = getProfileDbPath(userId, profileId);
  switchDatabase(dbPath);
  return data;
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  if (!mainWindow) return false;
  return mainWindow.isMaximized();
});

ipcMain.handle('app-save-zip', async (_e, { defaultPath, dataBase64 }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  const buffer = Buffer.from(dataBase64, 'base64');
  fs.writeFileSync(filePath, buffer);
  return { canceled: false, filePath };
});

ipcMain.handle('app-open-zip', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  });
  if (canceled || !filePaths?.length) return { canceled: true };
  const buffer = fs.readFileSync(filePaths[0]);
  return { canceled: false, filePath: filePaths[0], dataBase64: buffer.toString('base64') };
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
