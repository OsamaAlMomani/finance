import { app, BrowserWindow, ipcMain, Menu, globalShortcut, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDatabase, switchDatabase } from '../services/databaseService.js';
import { registerIpcHandlers } from './ipcHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

let mainWindow;
let dbInstance;
let menuVisible = true;
let appMenu = null;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false 
    },
    title: 'SketchBoard Finance Pro'
  });

  if (isDev) {
    const devUrl = 'http://localhost:5173';
    mainWindow.loadURL(devUrl);

    mainWindow.webContents.on('did-fail-load', () => {
      mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    });

    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize Database (per-user, per-profile)
  const usersData = loadUsers();
  let { activeUserId, users } = usersData;
  if (!activeUserId) {
    const defaultProfile = { id: crypto.randomUUID(), name: 'Default Profile', created_at: new Date().toISOString() };
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
    const defaultProfile = { id: crypto.randomUUID(), name: 'Default Profile', created_at: new Date().toISOString() };
    activeUser.profiles = [defaultProfile];
    activeUser.activeProfileId = defaultProfile.id;
    saveUsers({ activeUserId: activeUser.id, users });
  }

  const activeProfileId = activeUser?.activeProfileId || activeUser?.profiles?.[0]?.id;
  const dbPath = getProfileDbPath(activeUser.id, activeProfileId);
  console.log('Initializing database at:', dbPath);
  try {
    dbInstance = initDatabase(dbPath);
    registerIpcHandlers();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }

  createWindow();
  createAppMenu();

  globalShortcut.register('Ctrl+Shift+M', () => {
    toggleMenuVisibility();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle('user-get-all', () => {
  return loadUsers();
});

ipcMain.handle('user-create', (e, name, avatar) => {
  const data = loadUsers();
  const defaultProfile = { id: crypto.randomUUID(), name: 'Default Profile', created_at: new Date().toISOString() };
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
  dbInstance = switchDatabase(dbPath);
  return data;
});

ipcMain.handle('profile-create', (e, userId, name, avatar) => {
  const data = loadUsers();
  const user = data.users?.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  const newProfile = { id: crypto.randomUUID(), name: name || 'Profile', created_at: new Date().toISOString(), avatar: avatar || null };
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
  dbInstance = switchDatabase(dbPath);
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
