/**
 * Test Setup File
 * Runs before each test file
 */
import '@testing-library/jest-dom'
import React from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'

// Mock Recharts ResponsiveContainer to avoid zero-size warnings in tests
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')

  const MockResponsiveContainer = ({ width = 800, height = 320, children }: {
    width?: number | string
    height?: number | string
    children: React.ReactNode
  }) => {
    const numericWidth = typeof width === 'number' ? width : 800
    const numericHeight = typeof height === 'number' ? height : 320

    if (typeof children === 'function') {
      return (children as (args: { width: number; height: number }) => React.ReactNode)({
        width: numericWidth,
        height: numericHeight
      })
    }

    const childArray = React.Children.toArray(children)
    const child = childArray[0]

    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        width: numericWidth,
        height: numericHeight
      } as Record<string, unknown>)
    }

    return React.createElement('div', { style: { width: numericWidth, height: numericHeight } }, children)
  }

  return {
    ...actual,
    ResponsiveContainer: MockResponsiveContainer
  }
})

// Mock analytics service
vi.mock('@ui/services/analytics', () => ({
  getAnalyticsSettings: vi.fn(() => ({ enabled: false, endpoint: '' })),
  updateAnalyticsSettings: vi.fn(),
  initAnalytics: vi.fn(),
  trackEvent: vi.fn().mockResolvedValue(undefined),
  flushQueue: vi.fn().mockResolvedValue(undefined),
}))

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// Mock IntersectionObserver
beforeAll(() => {
  class MockIntersectionObserver {
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
    root = null
    rootMargin = ''
    thresholds = []
    takeRecords = vi.fn()
  }
  
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  })
})

// Mock ResizeObserver
beforeAll(() => {
  class MockResizeObserver {
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
  }
  
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: MockResizeObserver,
  })
})

// Mock localStorage
beforeAll(() => {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })
})

// Mock Electron IPC
beforeAll(() => {
  Object.defineProperty(window, 'electron', {
    writable: true,
    value: {
      ipcRenderer: {
        invoke: vi.fn(),
        on: vi.fn(),
        send: vi.fn(),
        removeAllListeners: vi.fn(),
      },
    },
  })
})

// Mock scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// Suppress console errors in tests (optional)
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

// Custom matchers type declarations
declare global {
  namespace Vi {
    interface Assertion {
      toBeInTheDocument(): void
      toHaveClass(className: string): void
      toHaveStyle(style: Record<string, unknown>): void
      toBeVisible(): void
      toBeDisabled(): void
      toHaveValue(value: unknown): void
      toHaveTextContent(text: string | RegExp): void
    }
  }
}

export {}
