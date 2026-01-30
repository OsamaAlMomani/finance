/**
 * Test Utilities and Helpers
 * Common utilities for testing React components
 */
import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ThemeProvider } from '@ui/contexts/ThemeContext'
import { NotificationProvider } from '@ui/contexts/NotificationContext'
import { KeyboardShortcutsProvider } from '@ui/contexts/KeyboardShortcutsContext'

// ============ PROVIDERS ============

interface WrapperProps {
  children: ReactNode
}

/**
 * Default wrapper with Router
 */
const AllProviders = ({ children }: WrapperProps) => {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </NotificationProvider>
    </ThemeProvider>
  )
}

// ============ CUSTOM RENDER ============

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  initialEntries?: string[]
  withRouter?: boolean
}

/**
 * Custom render function with all providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const { initialEntries = ['/'], withRouter = true, ...renderOptions } = options
  
  const Wrapper = ({ children }: WrapperProps) => (
    <ThemeProvider>
      <NotificationProvider>
        {withRouter ? (
          <MemoryRouter initialEntries={initialEntries}>
            <KeyboardShortcutsProvider>
              {children}
            </KeyboardShortcutsProvider>
          </MemoryRouter>
        ) : (
          <KeyboardShortcutsProvider>
            {children}
          </KeyboardShortcutsProvider>
        )}
      </NotificationProvider>
    </ThemeProvider>
  )
  
  const user = userEvent.setup()
  
  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  }
}

/**
 * Render function for components that include their own Router (like App)
 */
export function renderApp(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const Wrapper = ({ children }: WrapperProps) => (
    <ThemeProvider>
      <NotificationProvider>
        <KeyboardShortcutsProvider>
          {children}
        </KeyboardShortcutsProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
  
  const user = userEvent.setup()
  
  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...options })
  }
}

// ============ MOCK FACTORIES ============

/**
 * Create mock transaction data
 */
export function createMockTransaction(overrides = {}) {
  return {
    id: `t-${Date.now()}`,
    type: 'expense',
    description: 'Test Transaction',
    amount: 100,
    date: '2026-01-15',
    category: 'Food',
    recurring: 'once',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create mock expense data
 */
export function createMockExpense(overrides = {}) {
  return {
    id: `e-${Date.now()}`,
    category: 'Food',
    amount: 50,
    recurring: false,
    date: '2026-01-15',
    description: 'Test Expense',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create mock budget data
 */
export function createMockBudget(overrides = {}) {
  return {
    id: `b-${Date.now()}`,
    name: 'Test Budget',
    category: 'Food',
    period: 'monthly',
    limitAmount: 500,
    description: 'Test budget description',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create mock goal data
 */
export function createMockGoal(overrides = {}) {
  return {
    id: `g-${Date.now()}`,
    name: 'Test Goal',
    category: 'Savings',
    currentAmount: 500,
    targetAmount: 1000,
    targetDate: '2026-12-31',
    description: 'Test goal description',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create mock timeline event data
 */
export function createMockTimelineEvent(overrides = {}) {
  return {
    id: `te-${Date.now()}`,
    title: 'Test Event',
    description: 'Test event description',
    date: '2026-01-15',
    category: 'work',
    tags: ['test', 'sample'],
    icon: 'fa-star',
    ...overrides
  }
}

// ============ IPC MOCKING ============

/**
 * Setup mock IPC responses
 */
export function setupMockIPC(responses: Record<string, unknown> = {}) {
  const mockInvoke = vi.fn().mockImplementation((channel: string, ...args: unknown[]) => {
    if (channel in responses) {
      const response = responses[channel]
      return Promise.resolve(typeof response === 'function' ? response(...args) : response)
    }
    return Promise.resolve([])
  })
  
  ;(window as any).electron = {
    ipcRenderer: {
      invoke: mockInvoke,
      on: vi.fn(),
      send: vi.fn(),
      removeAllListeners: vi.fn(),
    },
  }
  
  return mockInvoke
}

/**
 * Clear IPC mocks
 */
export function clearMockIPC() {
  if ((window as any).electron?.ipcRenderer) {
    vi.clearAllMocks()
  }
}

// ============ ASYNC UTILITIES ============

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now()
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition')
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}

/**
 * Wait for next tick
 */
export function waitForNextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

// ============ DOM UTILITIES ============

/**
 * Get computed style value
 */
export function getComputedStyleValue(element: Element, property: string): string {
  return window.getComputedStyle(element).getPropertyValue(property)
}

/**
 * Check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  )
}

/**
 * Get z-index of element
 */
export function getZIndex(element: Element): number {
  const zIndex = window.getComputedStyle(element).zIndex
  return zIndex === 'auto' ? 0 : parseInt(zIndex, 10)
}

// ============ EVENT UTILITIES ============

/**
 * Create custom event
 */
export function createCustomEvent<T>(name: string, detail: T): CustomEvent<T> {
  return new CustomEvent(name, { detail, bubbles: true })
}

/**
 * Dispatch custom event on window
 */
export function dispatchWindowEvent<T>(name: string, detail: T): void {
  window.dispatchEvent(createCustomEvent(name, detail))
}

// ============ STORAGE UTILITIES ============

/**
 * Mock localStorage with data
 */
export function mockLocalStorage(data: Record<string, string> = {}) {
  const store: Record<string, string> = { ...data }
  
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    length: Object.keys(store).length,
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
  
  Object.defineProperty(window, 'localStorage', { value: mockStorage })
  
  return mockStorage
}

// Export all testing library utilities
export * from '@testing-library/react'
export { userEvent }
