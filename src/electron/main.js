import { app, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { register } from 'esbuild-register/dist/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Allow importing .ts files (ipc handlers + database) in the main process
const { unregister } = register({ extensions: ['.ts'] })

async function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    })

    // Lazy-load TS modules after the esbuild register hook is active
    const { registerIpcHandlers } = await import('./ipcHandlers.ts')
    const { initializeDatabase } = await import('../services/database.ts')

    // Initialize SQLite schema then wire IPC before showing the UI
    await initializeDatabase()
    registerIpcHandlers(mainWindow)

    await mainWindow.loadFile(path.join(app.getAppPath(), '/react-dist/index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    unregister()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
