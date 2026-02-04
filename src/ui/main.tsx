import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { KeyboardShortcutsProvider } from './contexts/KeyboardShortcutsContext'
import '../styles/index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <NotificationProvider>
        <KeyboardShortcutsProvider>
          <App />
        </KeyboardShortcutsProvider>
      </NotificationProvider>
    </ThemeProvider>
  </StrictMode>,
)
