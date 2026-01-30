import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Home,
  Clock,
  Target,
  LineChart,
  DollarSign,
  Settings,
  Plus,
  Menu,
  X,
  Search
} from 'lucide-react'
import QuickAddModal from './QuickAddModal'
import ThemeSelector from './common/ThemeSelector'
import { useKeyboardShortcuts } from '../contexts/KeyboardShortcutsContext'
import { trackEvent } from '../services/analytics'
import '../styles/Layout.css'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <Home size={20} />, path: '/' },
  { id: 'timeline', label: 'Timeline', icon: <Clock size={20} />, path: '/timeline' },
  { id: 'plan', label: 'Plan', icon: <Target size={20} />, path: '/plan' },
  { id: 'insights', label: 'Insights', icon: <LineChart size={20} />, path: '/insights' },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, path: '/settings' }
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddInitialType, setQuickAddInitialType] = useState<'income' | 'expense' | undefined>(undefined)
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts()

  const isActive = (path: string) => location.pathname === path

  // Register navigation keyboard shortcuts
  useEffect(() => {
    const shortcuts = [
      { id: 'nav-home', key: 'h', modifiers: { ctrl: true }, description: 'Go to Overview', category: 'Navigation', action: () => navigate('/') },
      { id: 'nav-timeline', key: 't', modifiers: { ctrl: true }, description: 'Go to Timeline', category: 'Navigation', action: () => navigate('/timeline') },
      { id: 'nav-plan', key: 'p', modifiers: { ctrl: true }, description: 'Go to Plan', category: 'Navigation', action: () => navigate('/plan') },
      { id: 'nav-insights', key: 'i', modifiers: { ctrl: true, shift: true }, description: 'Go to Insights', category: 'Navigation', action: () => navigate('/insights') },
      { id: 'nav-settings', key: ',', modifiers: { ctrl: true }, description: 'Go to Settings', category: 'Navigation', action: () => navigate('/settings') },
      { id: 'quick-add', key: 'n', modifiers: { ctrl: true }, description: 'Open Quick Add', category: 'Actions', action: () => { setQuickAddInitialType(undefined); setShowQuickAdd(true); } },
      { id: 'quick-income', key: 'i', modifiers: { ctrl: true }, description: 'Add Income', category: 'Actions', action: () => { setQuickAddInitialType('income'); setShowQuickAdd(true); } },
      { id: 'quick-expense', key: 'e', modifiers: { ctrl: true }, description: 'Add Expense', category: 'Actions', action: () => { setQuickAddInitialType('expense'); setShowQuickAdd(true); } },
      { id: 'toggle-sidebar', key: 'b', modifiers: { ctrl: true }, description: 'Toggle Sidebar', category: 'View', action: () => setSidebarOpen(prev => !prev) },
    ];

    shortcuts.forEach(s => registerShortcut(s));

    return () => {
      shortcuts.forEach(s => unregisterShortcut(s.id));
    };
  }, [navigate, registerShortcut, unregisterShortcut]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ type?: 'income' | 'expense' }>
      setQuickAddInitialType(customEvent.detail?.type)
      setShowQuickAdd(true)
    }

    window.addEventListener('finance:quickAdd', handler as EventListener)
    return () => window.removeEventListener('finance:quickAdd', handler as EventListener)
  }, [])

  useEffect(() => {
    void trackEvent('page_view', { path: location.pathname })
  }, [location.pathname])

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <DollarSign size={24} className="logo-icon" />
            {sidebarOpen && <h2>Finance</h2>}
          </div>
          <button
            className="toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={!sidebarOpen ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-footer">
            <button
              className="quick-add-btn"
              onClick={() => {
                setQuickAddInitialType(undefined)
                setShowQuickAdd(true)
              }}
            >
              <Plus size={18} />
              Quick Add
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-left">
            <div className="search-box">
              <Search size={18} />
              <input type="text" placeholder="Search transactions..." />
            </div>
          </div>
          <div className="topbar-right">
            <ThemeSelector />
            <button
              className="quick-add-icon-btn"
              onClick={() => {
                setQuickAddInitialType(undefined)
                setShowQuickAdd(true)
              }}
              title="Quick Add"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        initialType={quickAddInitialType}
      />
    </div>
  )
}
