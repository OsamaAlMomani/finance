import { app, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { register } from 'esbuild-register/dist/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { unregister } = register({ extensions: ['.ts'] })

async function run() {
  await app.whenReady()

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../src/electron/preload.cjs')
    }
  })

  window.webContents.on('console-message', (_event, level, message) => {
    console.log(`renderer console [${level}]:`, message)
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('preload-error at', preloadPath, error)
  })

  const { registerIpcHandlers } = await import('../src/electron/ipcHandlers.ts')
  const { initializeDatabase } = await import('../src/services/database.ts')

  await initializeDatabase()
  registerIpcHandlers(window)

  await window.loadFile(path.join(__dirname, '../react-dist/index.html'))

  const result = await window.webContents.executeJavaScript(`
    (async () => {
      try {
        if (!window.electron || !window.electron.ipcRenderer) {
          return { error: 'preload not available' }
        }
        const data = await window.electron.ipcRenderer.invoke('get-transactions')
        return { ok: true, data }
      } catch (err) {
        return { error: err?.message || String(err) }
      }
    })()
  `)

  if (result?.ok) {
    console.log('IPC get-transactions returned', Array.isArray(result.data) ? `${result.data.length} rows` : result.data)
  } else {
    console.error('IPC smoke renderer error', result?.error)
  }

  await app.quit()
  unregister()
}

run().catch((error) => {
  console.error('IPC smoke test failed:', error)
  unregister()
  app.quit()
})
