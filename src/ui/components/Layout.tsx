import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  Home,
  TrendingDown,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Wallet,
  DollarSign,
  Settings,
  Plus,
  Menu,
  X,
  Search
} from 'lucide-react'
import QuickAddModal from './QuickAddModal'
import '../styles/Layout.css'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <Home size={20} />, path: '/' },
  { id: 'transactions', label: 'Transactions', icon: <TrendingDown size={20} />, path: '/transactions' },
  { id: 'calendar', label: 'Calendar', icon: <Calendar size={20} />, path: '/calendar' },
  { id: 'forecast', label: 'Forecast', icon: <TrendingUp size={20} />, path: '/forecast' },
  { id: 'risk', label: 'Risk', icon: <AlertTriangle size={20} />, path: '/risk' },
  { id: 'budgets', label: 'Budgets', icon: <Wallet size={20} />, path: '/budgets' },
  { id: 'tax', label: 'Tax', icon: <DollarSign size={20} />, path: '/tax' },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, path: '/settings' }
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  const isActive = (path: string) => location.pathname === path

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
              onClick={() => setShowQuickAdd(true)}
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
            <button
              className="quick-add-icon-btn"
              onClick={() => setShowQuickAdd(true)}
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
      <QuickAddModal isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </div>
  )
}
