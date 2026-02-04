import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './sections/OverviewEnhanced'
import Timeline from './sections/Timeline'
import Plan from './sections/Plan'
import Insights from './sections/Insights'
import Settings from './sections/Settings'
import { ToastContainer } from './components/common/Toast'
import { KeyboardShortcutsHelp } from './components/common/KeyboardShortcutsHelp'
import { CommandPalette } from './components/common'
import { initAnalytics, trackEvent } from './services/analytics'

function App() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Global Ctrl+K handler for command palette
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setCommandPaletteOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  useEffect(() => {
    initAnalytics()
    void trackEvent('app_opened')
  }, [])

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastContainer position="top-right" />
      <KeyboardShortcutsHelp />
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
    </Router>
  )
}

export default App
