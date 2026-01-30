/**
 * App Integration Tests
 * Tests for the full application integration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../utils/test-utils'
import App from '@ui/App'

// Mock dependencies - extends the global mock
vi.mock('@ui/services/analytics', () => ({
  initAnalytics: vi.fn(),
  trackEvent: vi.fn(),
  getAnalyticsSettings: vi.fn(() => ({ enabled: false, endpoint: '' })),
  updateAnalyticsSettings: vi.fn(),
  flushQueue: vi.fn().mockResolvedValue(undefined),
}))

describe('App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear IPC - use demo data
    ;(window as any).electron = undefined
  })

  describe('Application Bootstrap', () => {
    it('should render the application without crashing', () => {
      renderApp(<App />)
      
      expect(document.body).toBeInTheDocument()
    })

    it('should initialize analytics on mount', async () => {
      const { initAnalytics } = await import('@ui/services/analytics')
      
      renderApp(<App />)
      
      expect(initAnalytics).toHaveBeenCalled()
    })

    it('should render the layout structure', () => {
      renderApp(<App />)
      
      expect(document.querySelector('.layout')).toBeInTheDocument()
      expect(document.querySelector('.sidebar')).toBeInTheDocument()
      expect(document.querySelector('.main-content')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should start on the Overview page', () => {
      renderApp(<App />)
      
      const navItem = screen.getByText('Overview').closest('.nav-item')
      expect(navItem).toHaveClass('active')
    })

    it('should navigate to Timeline when clicking Timeline nav', async () => {
      const { user } = renderApp(<App />)
      
      await user.click(screen.getByText('Timeline'))
      
      await waitFor(() => {
        expect(screen.getByText('My Timeline')).toBeInTheDocument()
      })
    })

    it('should navigate to Plan when clicking Plan nav', async () => {
      const { user } = renderApp(<App />)
      
      await user.click(screen.getByText('Plan'))
      
      await waitFor(() => {
        const navItem = screen.getByText('Plan').closest('.nav-item')
        expect(navItem).toHaveClass('active')
      })
    })

    it('should navigate to Insights when clicking Insights nav', async () => {
      const { user } = renderApp(<App />)
      
      await user.click(screen.getByText('Insights'))
      
      await waitFor(() => {
        const navItem = screen.getByText('Insights').closest('.nav-item')
        expect(navItem).toHaveClass('active')
      })
    })

    it('should navigate to Settings when clicking Settings nav', async () => {
      const { user } = renderApp(<App />)
      
      // Get sidebar and find Settings nav item within it
      const sidebar = document.querySelector('.sidebar-nav')!
      const settingsNavItem = within(sidebar as HTMLElement).getByText('Settings').closest('.nav-item')
      
      await user.click(settingsNavItem!)
      
      await waitFor(() => {
        expect(settingsNavItem).toHaveClass('active')
      })
    })
  })

  describe('Sidebar Interaction', () => {
    it('should toggle sidebar when clicking toggle button', async () => {
      const { user } = renderApp(<App />)
      
      const sidebar = document.querySelector('.sidebar')
      const toggleBtn = document.querySelector('.toggle-btn')
      
      expect(sidebar).toHaveClass('open')
      
      await user.click(toggleBtn!)
      
      expect(sidebar).toHaveClass('closed')
    })

    it('should open Quick Add modal when clicking Quick Add', async () => {
      const { user } = renderApp(<App />)
      
      await user.click(screen.getByText('Quick Add'))
      
      await waitFor(() => {
        expect(document.querySelector('.quick-add-overlay')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('should have a search input in the topbar', () => {
      renderApp(<App />)
      
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      expect(searchInput).toBeInTheDocument()
    })

    it('should allow typing in search box', async () => {
      const { user } = renderApp(<App />)
      
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      await user.type(searchInput, 'test query')
      
      expect(searchInput).toHaveValue('test query')
    })
  })

  describe('Command Palette', () => {
    it('should open command palette with Ctrl+K', async () => {
      const { user } = renderApp(<App />)
      
      await user.keyboard('{Control>}k{/Control}')
      
      await waitFor(() => {
        expect(document.querySelector('.command-palette')).toBeInTheDocument()
      })
    })
  })

  describe('Toast Notifications', () => {
    it('should not render toast container when no notifications', () => {
      renderApp(<App />)
      
      // Toast container should not render when empty
      const toastContainer = document.querySelector('.toast-container')
      expect(toastContainer).not.toBeInTheDocument()
    })
  })
})

describe('Cross-Page Data Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).electron = undefined
  })

  it('should maintain sidebar state across navigation', async () => {
    const { user } = renderApp(<App />)
    
    const sidebar = document.querySelector('.sidebar')
    const toggleBtn = document.querySelector('.toggle-btn')
    
    // Close sidebar
    await user.click(toggleBtn!)
    expect(sidebar).toHaveClass('closed')
    
    // Navigate to another page using title attribute (visible when closed)
    const timelineNav = document.querySelector('[title="Timeline"]')!
    await user.click(timelineNav)
    
    // Sidebar should remain closed
    expect(sidebar).toHaveClass('closed')
  })

  it('should render different content for each page', async () => {
    const { user } = renderApp(<App />)
    
    // Overview page
    expect(document.querySelector('.main-content')).toBeInTheDocument()
    
    // Navigate using sidebar nav
    const sidebarNav = document.querySelector('.sidebar-nav')!
    
    // Timeline page - click nav item with Timeline label
    const timelineNav = within(sidebarNav as HTMLElement).getByText('Timeline').closest('.nav-item')
    await user.click(timelineNav!)
    await waitFor(() => {
      expect(screen.getByText('My Timeline')).toBeInTheDocument()
    })
    
    // Settings page - click nav item with Settings label
    const settingsNav = within(sidebarNav as HTMLElement).getByText('Settings').closest('.nav-item')
    await user.click(settingsNav!)
    await waitFor(() => {
      expect(settingsNav).toHaveClass('active')
    })
  })
})
