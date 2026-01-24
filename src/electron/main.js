import {app, BrowserWindow, ipcMain} from "electron";
import path from "path";
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.on("ready", () => {
    const mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    mainWindow.loadFile(path.join(app.getAppPath(), "/react-dist/index.html"));
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});
