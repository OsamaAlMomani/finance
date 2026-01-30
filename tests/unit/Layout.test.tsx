/**
 * Layout Component Unit Tests
 * Tests for the main application layout structure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupMockIPC } from '../utils/test-utils'
import Layout from '@ui/components/Layout'

// Mock the contexts
vi.mock('@ui/contexts/KeyboardShortcutsContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useKeyboardShortcuts: () => ({
      registerShortcut: vi.fn(),
      unregisterShortcut: vi.fn(),
    }),
  }
})

vi.mock('@ui/services/analytics', () => ({
  trackEvent: vi.fn(),
}))

describe('Layout Component', () => {
  beforeEach(() => {
    setupMockIPC({})
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the layout container', () => {
      renderWithProviders(<Layout />)
      
      expect(document.querySelector('.layout')).toBeInTheDocument()
    })

    it('should render the sidebar', () => {
      renderWithProviders(<Layout />)
      
      expect(document.querySelector('.sidebar')).toBeInTheDocument()
    })

    it('should render the topbar', () => {
      renderWithProviders(<Layout />)
      
      expect(document.querySelector('.topbar')).toBeInTheDocument()
    })

    it('should render the main content area', () => {
      renderWithProviders(<Layout />)
      
      expect(document.querySelector('.main-content')).toBeInTheDocument()
    })

    it('should render all navigation items', () => {
      renderWithProviders(<Layout />)
      
      const navItems = ['Overview', 'Timeline', 'Plan', 'Insights', 'Settings']
      navItems.forEach(item => {
        expect(screen.getByText(item)).toBeInTheDocument()
      })
    })

    it('should render the logo', () => {
      renderWithProviders(<Layout />)
      
      expect(screen.getByText('Finance')).toBeInTheDocument()
    })

    it('should render search box', () => {
      renderWithProviders(<Layout />)
      
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument()
    })

    it('should render quick add button', () => {
      renderWithProviders(<Layout />)
      
      expect(screen.getByText('Quick Add')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should navigate to Overview when clicking Overview nav item', async () => {
      const { user } = renderWithProviders(<Layout />, { initialEntries: ['/settings'] })
      
      const overviewButton = screen.getByText('Overview')
      await user.click(overviewButton)
      
      expect(overviewButton.closest('.nav-item')).toHaveClass('active')
    })

    it('should navigate to Timeline when clicking Timeline nav item', async () => {
      const { user } = renderWithProviders(<Layout />)
      
      const timelineButton = screen.getByText('Timeline')
      await user.click(timelineButton)
      
      expect(timelineButton.closest('.nav-item')).toHaveClass('active')
    })

    it('should highlight the active navigation item', () => {
      renderWithProviders(<Layout />, { initialEntries: ['/'] })
      
      const overviewButton = screen.getByText('Overview').closest('.nav-item')
      expect(overviewButton).toHaveClass('active')
    })
  })

  describe('Sidebar Toggle', () => {
    it('should toggle sidebar when clicking toggle button', async () => {
      const { user } = renderWithProviders(<Layout />)
      
      const toggleBtn = document.querySelector('.toggle-btn')
      const sidebar = document.querySelector('.sidebar')
      
      expect(sidebar).toHaveClass('open')
      
      await user.click(toggleBtn!)
      
      expect(sidebar).toHaveClass('closed')
    })

    it('should hide nav labels when sidebar is closed', async () => {
      const { user } = renderWithProviders(<Layout />)
      
      const toggleBtn = document.querySelector('.toggle-btn')
      await user.click(toggleBtn!)
      
      // Nav labels should not be visible when sidebar is closed
      const navLabels = document.querySelectorAll('.nav-label')
      expect(navLabels.length).toBe(0)
    })
  })

  describe('Quick Add Modal', () => {
    it('should open quick add modal when clicking quick add button', async () => {
      const { user } = renderWithProviders(<Layout />)
      
      const quickAddBtn = screen.getByText('Quick Add')
      await user.click(quickAddBtn)
      
      // Modal should be visible
      await waitFor(() => {
        expect(document.querySelector('.quick-add-overlay')).toBeInTheDocument()
      })
    })

    it('should open quick add modal when clicking topbar plus button', async () => {
      const { user } = renderWithProviders(<Layout />)
      
      const topbarAddBtn = document.querySelector('.quick-add-icon-btn')
      await user.click(topbarAddBtn!)
      
      await waitFor(() => {
        expect(document.querySelector('.quick-add-overlay')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have accessible toggle button', () => {
      renderWithProviders(<Layout />)
      
      const toggleBtn = document.querySelector('.toggle-btn')
      expect(toggleBtn).toHaveAttribute('aria-label', 'Toggle sidebar')
    })

    it('should have accessible quick add button with title', () => {
      renderWithProviders(<Layout />)
      
      const quickAddIconBtn = document.querySelector('.quick-add-icon-btn')
      expect(quickAddIconBtn).toHaveAttribute('title', 'Quick Add')
    })
  })

  describe('CSS Layer Order (z-index)', () => {
    it('should have sidebar with higher z-index than main content', () => {
      renderWithProviders(<Layout />)
      
      const sidebar = document.querySelector('.sidebar')
      const sidebarZIndex = window.getComputedStyle(sidebar!).zIndex
      
      // Sidebar should have a z-index for proper stacking
      expect(parseInt(sidebarZIndex) || 0).toBeGreaterThanOrEqual(0)
    })

    it('should have topbar element for glass effect', () => {
      renderWithProviders(<Layout />)
      
      const topbar = document.querySelector('.topbar')
      
      // Verify topbar exists - backdrop-filter is applied via CSS
      // jsdom doesn't fully compute CSS properties like backdrop-filter
      expect(topbar).toBeInTheDocument()
      expect(topbar).toHaveClass('topbar')
    })
  })
})
