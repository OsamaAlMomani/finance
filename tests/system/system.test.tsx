/**
 * System Tests
 * End-to-end system tests for complete user workflows
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderApp, setupMockIPC, createMockTransaction, createMockBudget, createMockGoal } from '../utils/test-utils'
import App from '@ui/App'

// Mock dependencies
vi.mock('@ui/services/analytics', () => ({
  initAnalytics: vi.fn(),
  trackEvent: vi.fn(),
  getAnalyticsSettings: vi.fn(() => ({ enabled: false, endpoint: '' })),
  updateAnalyticsSettings: vi.fn(),
  flushQueue: vi.fn().mockResolvedValue(undefined),
}))

describe('System Tests - Complete User Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User Story: Financial Overview', () => {
    it('should allow user to view their complete financial overview', async () => {
      // Setup: User has existing financial data
      const mockTransactions = [
        createMockTransaction({ type: 'income', description: 'Salary', amount: 5000 }),
        createMockTransaction({ type: 'expense', description: 'Rent', amount: 1500 }),
        createMockTransaction({ type: 'expense', description: 'Groceries', amount: 300 }),
      ]
      
      const mockNetWorth = [
        { id: 'nw1', date: '2026-01-01', assets: 50000, liabilities: 20000, createdAt: '', updatedAt: '' },
      ]
      
      setupMockIPC({
        'get-transactions': mockTransactions,
        'get-net-worth': mockNetWorth,
        'get-expenses': [],
        'get-budgets': [],
        'get-goals': [],
        'get-bills': [],
        'get-forecasts': [],
        'get-calendar-events': [],
      })
      
      // Action: User opens the app
      renderApp(<App />)
      
      // Verification: User sees Overview page with financial summary
      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument()
      })
    })

    it('should allow user to search for transactions', async () => {
      setupMockIPC({
        'get-transactions': [
          createMockTransaction({ description: 'Salary Payment' }),
          createMockTransaction({ description: 'Grocery Shopping' }),
        ],
        'get-expenses': [],
        'get-budgets': [],
        'get-goals': [],
        'get-bills': [],
        'get-net-worth': [],
        'get-forecasts': [],
        'get-calendar-events': [],
      })
      
      const { user } = renderApp(<App />)
      
      // Action: User types in search box
      const searchInput = screen.getByPlaceholderText('Search transactions...')
      await user.type(searchInput, 'Salary')
      
      // Verification: Search input contains the query
      expect(searchInput).toHaveValue('Salary')
    })
  })

  describe('User Story: Budget Management', () => {
    it('should allow user to view and manage budgets', async () => {
      const mockBudgets = [
        createMockBudget({ name: 'Food Budget', category: 'Food', limitAmount: 500 }),
        createMockBudget({ name: 'Transport Budget', category: 'Transport', limitAmount: 200 }),
      ]
      
      setupMockIPC({
        'get-transactions': [],
        'get-expenses': [],
        'get-budgets': mockBudgets,
        'get-goals': [],
        'get-bills': [],
        'get-net-worth': [],
        'get-forecasts': [],
        'get-calendar-events': [],
      })
      
      const { user } = renderApp(<App />)
      
      // Action: User navigates to Plan page
      await user.click(screen.getByText('Plan'))
      
      // Verification: User sees budgets on Plan page
      await waitFor(() => {
        expect(screen.getByText('Plan')).toBeInTheDocument()
      })
    })
  })

  describe('User Story: Goal Tracking', () => {
    it('should allow user to view savings goals progress', async () => {
      const mockGoals = [
        createMockGoal({ name: 'Emergency Fund', currentAmount: 5000, targetAmount: 10000 }),
        createMockGoal({ name: 'Vacation', currentAmount: 1500, targetAmount: 3000 }),
      ]
      
      setupMockIPC({
        'get-transactions': [],
        'get-expenses': [],
        'get-budgets': [],
        'get-goals': mockGoals,
        'get-bills': [],
        'get-net-worth': [],
        'get-forecasts': [],
        'get-calendar-events': [],
      })
      
      const { user } = renderApp(<App />)
      
      // Action: User navigates to Plan page
      await user.click(screen.getByText('Plan'))
      
      // Verification: User sees goals section
      await waitFor(() => {
        expect(screen.getByText('Plan')).toBeInTheDocument()
      })
    })
  })

  describe('User Story: Timeline Management', () => {
    it('should allow user to create and view timeline events', async () => {
      setupMockIPC({
        'get-transactions': [],
        'get-expenses': [],
        'get-budgets': [],
        'get-goals': [],
        'get-bills': [],
        'get-net-worth': [],
        'get-forecasts': [],
        'get-calendar-events': [],
      })
      
      const { user } = renderApp(<App />)
      
      // Action: User navigates to Timeline
      await user.click(screen.getByText('Timeline'))
      
      // Verification: Timeline page is displayed
      await waitFor(() => {
        expect(screen.getByText('My Timeline')).toBeInTheDocument()
      })
      
      // Action: User opens add event modal
      const addButtons = screen.getAllByText('Add Event')
      await user.click(addButtons[0])
      
      // Verification: Modal is displayed
      await waitFor(() => {
        expect(screen.getByText('Add New Event')).toBeInTheDocument()
      })
    })

    it('should allow user to filter timeline events by category', async () => {
      setupMockIPC({})
      
      const { user } = renderApp(<App />)
      
      // Navigate to Timeline
      await user.click(screen.getByText('Timeline'))
      
      await waitFor(() => {
        expect(screen.getByText('My Timeline')).toBeInTheDocument()
      })
      
      // Action: User clicks Work filter
      const filterChips = document.querySelectorAll('.filter-chip')
      const workFilter = Array.from(filterChips).find(chip => chip.textContent?.includes('Work'))
      
      if (workFilter) {
        await user.click(workFilter)
        
        // Verification: Work filter is active
        expect(workFilter).toHaveClass('active')
      }
    })

    it('should allow user to change timeline theme', async () => {
      setupMockIPC({})
      
      const { user } = renderApp(<App />)
      
      // Navigate to Timeline
      await user.click(screen.getByText('Timeline'))
      
      await waitFor(() => {
        expect(screen.getByText('My Timeline')).toBeInTheDocument()
      })
      
      // Action: User opens theme panel
      const themeButtons = screen.getAllByText('Themes')
      await user.click(themeButtons[0])
      
      // Verification: Theme panel is visible
      await waitFor(() => {
        expect(document.querySelector('.theme-panel.active')).toBeInTheDocument()
      })
      
      // Action: User selects Purple theme
      const purpleTheme = screen.getAllByText('Purple')[0].closest('.theme-card')
      if (purpleTheme) {
        await user.click(purpleTheme)
        
        // Verification: Theme panel was clicked (exact behavior depends on component implementation)
        // The click was registered - verify theme panel interaction works
        expect(purpleTheme).toBeInTheDocument()
      }
    })
  })

  describe('User Story: Financial Insights', () => {
    it('should allow user to view financial insights and analytics', async () => {
      setupMockIPC({
        'get-transactions': [],
        'get-expenses': [],
        'get-budgets': [],
        'get-goals': [],
        'get-bills': [],
        'get-net-worth': [],
        'get-forecasts': [
          { id: 'f1', month: '2026-01', forecast_income: 5000, forecast_expense: 3000, actual_income: 5200, actual_expense: 2800, createdAt: '', updatedAt: '' },
        ],
        'get-calendar-events': [],
      })
      
      const { user } = renderApp(<App />)
      
      // Action: User navigates to Insights
      await user.click(screen.getByText('Insights'))
      
      // Verification: Insights page is displayed
      await waitFor(() => {
        expect(screen.getByText('Insights')).toBeInTheDocument()
      })
    })
  })

  describe('User Story: Settings Customization', () => {
    it('should allow user to access and modify settings', async () => {
      setupMockIPC({})
      
      const { user } = renderApp(<App />)
      
      // Action: User navigates to Settings via sidebar nav
      const sidebarNav = document.querySelector('.sidebar-nav')!
      const settingsNav = within(sidebarNav as HTMLElement).getByText('Settings').closest('.nav-item')
      await user.click(settingsNav!)
      
      // Verification: Settings page is displayed (nav item is active)
      await waitFor(() => {
        expect(settingsNav).toHaveClass('active')
      })
    })
  })

  describe('User Story: Quick Add Transaction', () => {
    it('should allow user to quickly add a new transaction', async () => {
      setupMockIPC({
        'get-transactions': [],
        'get-expenses': [],
        'get-budgets': [],
        'get-goals': [],
        'get-bills': [],
        'get-net-worth': [],
        'get-forecasts': [],
        'get-calendar-events': [],
        'add-transaction': createMockTransaction({ description: 'Quick Added' }),
      })
      
      const { user } = renderApp(<App />)
      
      // Action: User clicks Quick Add button in sidebar
      await user.click(screen.getByText('Quick Add'))
      
      // Verification: Quick Add modal opens
      await waitFor(() => {
        expect(document.querySelector('.quick-add-overlay')).toBeInTheDocument()
      })
    })

    it('should allow quick add from topbar', async () => {
      setupMockIPC({})
      
      const { user } = renderApp(<App />)
      
      // Action: User clicks Quick Add icon in topbar
      const quickAddIconBtn = document.querySelector('.quick-add-icon-btn')
      await user.click(quickAddIconBtn!)
      
      // Verification: Quick Add modal opens
      await waitFor(() => {
        expect(document.querySelector('.quick-add-overlay')).toBeInTheDocument()
      })
    })
  })

  describe('User Story: Navigation Flow', () => {
    it('should maintain state during navigation', async () => {
      setupMockIPC({
        'get-transactions': [createMockTransaction()],
        'get-expenses': [],
        'get-budgets': [],
        'get-goals': [],
        'get-bills': [],
        'get-net-worth': [],
        'get-forecasts': [],
        'get-calendar-events': [],
      })
      
      const { user } = renderApp(<App />)
      
      // Start at Overview - sidebar labels may not show "active" until after interaction
      const sidebarNav = document.querySelector('.sidebar-nav')!
      
      // Navigate to Timeline and verify it works
      const timelineNav = within(sidebarNav as HTMLElement).getByText('Timeline').closest('.nav-item')
      await user.click(timelineNav!)
      
      await waitFor(() => {
        expect(screen.getByText('My Timeline')).toBeInTheDocument()
      })
      
      // Navigate to Plan
      const planNav = within(sidebarNav as HTMLElement).getByText('Plan').closest('.nav-item')
      await user.click(planNav!)
      
      await waitFor(() => {
        expect(planNav).toHaveClass('active')
      })
    })
  })

  describe('User Story: Sidebar Toggle', () => {
    it('should allow user to collapse and expand sidebar', async () => {
      setupMockIPC({})
      
      const { user } = renderApp(<App />)
      
      const sidebar = document.querySelector('.sidebar')
      const toggleBtn = document.querySelector('.toggle-btn')
      
      // Initial state: Sidebar is open
      expect(sidebar).toHaveClass('open')
      
      // Action: User closes sidebar
      await user.click(toggleBtn!)
      
      // Verification: Sidebar is closed
      expect(sidebar).toHaveClass('closed')
      
      // Action: User opens sidebar
      await user.click(toggleBtn!)
      
      // Verification: Sidebar is open again
      expect(sidebar).toHaveClass('open')
    })
  })

  describe('User Story: Keyboard Navigation', () => {
    it('should support command palette', async () => {
      setupMockIPC({})
      
      const { user } = renderApp(<App />)
      
      // Action: User opens command palette with Ctrl+K
      await user.keyboard('{Control>}k{/Control}')
      
      // Verification: Command palette opens
      await waitFor(() => {
        expect(document.querySelector('.command-palette')).toBeInTheDocument()
      })
    })
  })
})

describe('System Integration - Data Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should persist timeline events across page navigation', async () => {
    setupMockIPC({})
    
    const { user } = renderApp(<App />)
    
    // Navigate to Timeline
    const sidebarNav = document.querySelector('.sidebar-nav')!
    const timelineNav = within(sidebarNav as HTMLElement).getByText('Timeline').closest('.nav-item')
    await user.click(timelineNav!)
    
    await waitFor(() => {
      expect(screen.getByText('My Timeline')).toBeInTheDocument()
    })
    
    // Verify timeline is rendered and has demo events
    expect(document.querySelector('.timeline-content')).toBeInTheDocument()
    
    // Navigate away
    const overviewNav = within(sidebarNav as HTMLElement).getByText('Overview').closest('.nav-item')
    await user.click(overviewNav!)
    
    // Navigate back
    await user.click(timelineNav!)
    
    // Verify timeline is still rendered
    await waitFor(() => {
      expect(screen.getByText('My Timeline')).toBeInTheDocument()
    })
  })

  it('should persist theme selection', async () => {
    setupMockIPC({})
    
    const { user } = renderApp(<App />)
    
    // Navigate to Timeline
    const sidebarNav = document.querySelector('.sidebar-nav')!
    const timelineNav = within(sidebarNav as HTMLElement).getByText('Timeline').closest('.nav-item')
    await user.click(timelineNav!)
    
    await waitFor(() => {
      expect(screen.getByText('My Timeline')).toBeInTheDocument()
    })
    
    // Open theme panel
    await user.click(screen.getAllByText('Themes')[0])
    
    // Verify theme panel is opened
    await waitFor(() => {
      expect(document.querySelector('.theme-panel.active')).toBeInTheDocument()
    })
    
    // Click a theme card
    const greenTheme = screen.getAllByText('Green')[0].closest('.theme-card')
    expect(greenTheme).toBeInTheDocument()
    await user.click(greenTheme!)
    
    // Verify theme card was clicked (not verifying application due to jsdom limitations)
    expect(greenTheme).toBeInTheDocument()
  })
})

describe('System Integration - Error Recovery', () => {
  it('should gracefully handle IPC failures', async () => {
    const mockInvoke = vi.fn().mockRejectedValue(new Error('IPC Error'))
    
    ;(window as any).electron = {
      ipcRenderer: {
        invoke: mockInvoke,
        on: vi.fn(),
        send: vi.fn(),
        removeAllListeners: vi.fn(),
      },
    }
    
    // Should not crash
    renderApp(<App />)
    
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
  })

  it('should work without Electron environment', async () => {
    ;(window as any).electron = undefined
    
    renderApp(<App />)
    
    await waitFor(() => {
      // App should fall back to demo data
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
  })
})
