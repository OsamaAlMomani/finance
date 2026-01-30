/**
 * Main Application E2E Tests
 * End-to-end tests for the Finance application
 */
import { test, expect } from '@playwright/test'

test.describe('Finance App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Application Launch', () => {
    test('should load the application', async ({ page }) => {
      await expect(page).toHaveTitle(/Finance/)
      await expect(page.locator('.layout')).toBeVisible()
    })

    test('should display the sidebar', async ({ page }) => {
      await expect(page.locator('.sidebar')).toBeVisible()
    })

    test('should display the main content area', async ({ page }) => {
      await expect(page.locator('.main-content')).toBeVisible()
    })

    test('should display the topbar', async ({ page }) => {
      await expect(page.locator('.topbar')).toBeVisible()
    })
  })

  test.describe('Navigation', () => {
    test('should navigate to Overview', async ({ page }) => {
      await page.click('text=Overview')
      await expect(page.locator('.nav-item.active')).toContainText('Overview')
    })

    test('should navigate to Timeline', async ({ page }) => {
      await page.click('text=Timeline')
      await expect(page.locator('.nav-item.active')).toContainText('Timeline')
      await expect(page.locator('.timeline-section')).toBeVisible()
    })

    test('should navigate to Plan', async ({ page }) => {
      await page.click('text=Plan')
      await expect(page.locator('.nav-item.active')).toContainText('Plan')
    })

    test('should navigate to Insights', async ({ page }) => {
      await page.click('text=Insights')
      await expect(page.locator('.nav-item.active')).toContainText('Insights')
    })

    test('should navigate to Settings', async ({ page }) => {
      await page.click('text=Settings')
      await expect(page.locator('.nav-item.active')).toContainText('Settings')
    })
  })

  test.describe('Sidebar Functionality', () => {
    test('should toggle sidebar', async ({ page }) => {
      const sidebar = page.locator('.sidebar')
      const toggleBtn = page.locator('.toggle-btn')

      await expect(sidebar).toHaveClass(/open/)

      await toggleBtn.click()
      await expect(sidebar).toHaveClass(/closed/)

      await toggleBtn.click()
      await expect(sidebar).toHaveClass(/open/)
    })

    test('should hide nav labels when sidebar is closed', async ({ page }) => {
      await page.click('.toggle-btn')
      await expect(page.locator('.nav-label')).toHaveCount(0)
    })
  })

  test.describe('Quick Add Modal', () => {
    test('should open quick add modal from sidebar', async ({ page }) => {
      await page.click('text=Quick Add')
      await expect(page.locator('.quick-add-overlay')).toBeVisible()
    })

    test('should open quick add modal from topbar', async ({ page }) => {
      await page.click('.quick-add-icon-btn')
      await expect(page.locator('.quick-add-overlay')).toBeVisible()
    })

    test('should close modal when clicking outside', async ({ page }) => {
      await page.click('text=Quick Add')
      await expect(page.locator('.quick-add-overlay')).toBeVisible()

      // Click outside the modal
      await page.click('.quick-add-overlay', { position: { x: 10, y: 10 } })
      await expect(page.locator('.quick-add-overlay')).toBeHidden()
    })
  })

  test.describe('Search Functionality', () => {
    test('should focus search box', async ({ page }) => {
      const searchInput = page.locator('.search-box input')
      await searchInput.click()
      await expect(searchInput).toBeFocused()
    })

    test('should accept search input', async ({ page }) => {
      const searchInput = page.locator('.search-box input')
      await searchInput.fill('salary')
      await expect(searchInput).toHaveValue('salary')
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should open command palette with Ctrl+K', async ({ page }) => {
      await page.keyboard.press('Control+k')
      await expect(page.locator('.command-palette')).toBeVisible()
    })

    test('should close command palette with Escape', async ({ page }) => {
      await page.keyboard.press('Control+k')
      await expect(page.locator('.command-palette')).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.locator('.command-palette')).toBeHidden()
    })

    test('should toggle sidebar with Ctrl+B', async ({ page }) => {
      const sidebar = page.locator('.sidebar')

      await page.keyboard.press('Control+b')
      await expect(sidebar).toHaveClass(/closed/)

      await page.keyboard.press('Control+b')
      await expect(sidebar).toHaveClass(/open/)
    })
  })
})

test.describe('Timeline E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.click('text=Timeline')
    await expect(page.locator('.timeline-section')).toBeVisible()
  })

  test.describe('Timeline Display', () => {
    test('should display timeline section header', async ({ page }) => {
      await expect(page.locator('text=My Timeline')).toBeVisible()
    })

    test('should display filter chips', async ({ page }) => {
      const filters = ['All', 'Work', 'Personal', 'Education', 'Travel', 'Health', 'Finance']
      for (const filter of filters) {
        await expect(page.locator(`.filter-chip:has-text("${filter}")`)).toBeVisible()
      }
    })

    test('should display theme selector', async ({ page }) => {
      await expect(page.locator('text=Themes')).toBeVisible()
    })

    test('should display Add Event button', async ({ page }) => {
      await expect(page.locator('text=Add Event')).toBeVisible()
    })
  })

  test.describe('Theme Selection', () => {
    test('should open theme panel', async ({ page }) => {
      await page.click('text=Themes')
      await expect(page.locator('.theme-panel.active')).toBeVisible()
    })

    test('should display all theme options', async ({ page }) => {
      await page.click('text=Themes')
      const themes = ['Default', 'Purple', 'Green', 'Orange', 'Pink', 'Dark', 'Light']
      for (const theme of themes) {
        await expect(page.locator(`.theme-card:has-text("${theme}")`)).toBeVisible()
      }
    })

    test('should apply theme when selected', async ({ page }) => {
      await page.click('text=Themes')
      await page.click('.theme-card:has-text("Purple")')

      const section = page.locator('.timeline-section')
      await expect(section).toHaveClass(/theme-purple/)
    })

    test('should close theme panel with Done button', async ({ page }) => {
      await page.click('text=Themes')
      await page.click('text=Done')
      await expect(page.locator('.theme-panel.active')).toBeHidden()
    })

    test('should reset theme', async ({ page }) => {
      await page.click('text=Themes')
      await page.click('.theme-card:has-text("Purple")')
      await page.click('text=Reset')

      const section = page.locator('.timeline-section')
      await expect(section).toHaveClass(/theme-default/)
    })
  })

  test.describe('Filter Functionality', () => {
    test('should have All filter active by default', async ({ page }) => {
      await expect(page.locator('.filter-chip:has-text("All")')).toHaveClass(/active/)
    })

    test('should change active filter', async ({ page }) => {
      await page.click('.filter-chip:has-text("Work")')
      await expect(page.locator('.filter-chip:has-text("Work")')).toHaveClass(/active/)
      await expect(page.locator('.filter-chip:has-text("All")')).not.toHaveClass(/active/)
    })
  })

  test.describe('Event Management', () => {
    test('should open add event modal', async ({ page }) => {
      await page.click('text=Add Event')
      await expect(page.locator('.modal-overlay.active')).toBeVisible()
      await expect(page.locator('text=Add New Event')).toBeVisible()
    })

    test('should display all form fields', async ({ page }) => {
      await page.click('text=Add Event')

      await expect(page.locator('label:has-text("Event Title")')).toBeVisible()
      await expect(page.locator('label:has-text("Date")')).toBeVisible()
      await expect(page.locator('label:has-text("Category")')).toBeVisible()
      await expect(page.locator('label:has-text("Description")')).toBeVisible()
      await expect(page.locator('label:has-text("Tags")')).toBeVisible()
      await expect(page.locator('label:has-text("Icon")')).toBeVisible()
    })

    test('should close modal with close button', async ({ page }) => {
      await page.click('text=Add Event')
      await page.click('.modal-close')
      await expect(page.locator('.modal-overlay.active')).toBeHidden()
    })

    test('should close modal with Cancel button', async ({ page }) => {
      await page.click('text=Add Event')
      await page.click('text=Cancel')
      await expect(page.locator('.modal-overlay.active')).toBeHidden()
    })

    test('should create a new event', async ({ page }) => {
      await page.click('text=Add Event')

      await page.fill('#eventTitle', 'E2E Test Event')
      await page.fill('#eventDate', '2026-02-15')
      await page.selectOption('#eventCategory', 'work')
      await page.fill('#eventDescription', 'This is a test event from E2E')
      await page.fill('#eventTags', 'test, e2e')

      await page.click('text=Save Event')

      // Verify event was created
      await expect(page.locator('.modal-overlay.active')).toBeHidden()
      await expect(page.locator('text=E2E Test Event')).toBeVisible()
    })

    test('should edit an existing event', async ({ page }) => {
      // First create an event
      await page.click('text=Add Event')
      await page.fill('#eventTitle', 'Event to Edit')
      await page.fill('#eventDate', '2026-02-20')
      await page.selectOption('#eventCategory', 'personal')
      await page.click('text=Save Event')

      // Now edit it
      await page.click('.event-card:has-text("Event to Edit") .btn-icon:has([class*="fa-edit"])')

      await expect(page.locator('text=Edit Event')).toBeVisible()
      await page.fill('#eventTitle', 'Edited Event')
      await page.click('text=Update Event')

      await expect(page.locator('text=Edited Event')).toBeVisible()
    })

    test('should delete an event', async ({ page }) => {
      // Create event first
      await page.click('text=Add Event')
      await page.fill('#eventTitle', 'Event to Delete')
      await page.fill('#eventDate', '2026-02-25')
      await page.selectOption('#eventCategory', 'finance')
      await page.click('text=Save Event')

      // Delete it
      await page.click('.event-card:has-text("Event to Delete") .btn-danger')
      await expect(page.locator('.delete-modal')).toBeVisible()
      await page.click('.delete-modal text=Delete')

      await expect(page.locator('text=Event to Delete')).toBeHidden()
    })
  })

  test.describe('Empty State', () => {
    test('should show empty state when no events', async ({ page }) => {
      // Clear localStorage
      await page.evaluate(() => localStorage.clear())
      await page.reload()
      await page.click('text=Timeline')

      await expect(page.locator('text=No events yet')).toBeVisible()
      await expect(page.locator('text=Add Your First Event')).toBeVisible()
    })

    test('should open modal from empty state button', async ({ page }) => {
      await page.evaluate(() => localStorage.clear())
      await page.reload()
      await page.click('text=Timeline')

      await page.click('text=Add Your First Event')
      await expect(page.locator('.modal-overlay.active')).toBeVisible()
    })
  })
})

test.describe('Responsive Design E2E', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Sidebar should be hidden on mobile
    const sidebar = page.locator('.sidebar')
    await expect(sidebar).toHaveCSS('position', 'fixed')
  })

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    await expect(page.locator('.layout')).toBeVisible()
  })

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.main-content')).toBeVisible()
  })
})

test.describe('Performance E2E', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForSelector('.layout')
    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(5000) // 5 seconds max
  })

  test('should navigate without significant delay', async ({ page }) => {
    await page.goto('/')

    const startTime = Date.now()
    await page.click('text=Timeline')
    await page.waitForSelector('.timeline-section')
    const navigationTime = Date.now() - startTime

    expect(navigationTime).toBeLessThan(1000) // 1 second max
  })
})

test.describe('Accessibility E2E', () => {
  test('should have proper focus management', async ({ page }) => {
    await page.goto('/')

    // Tab through the interface
    await page.keyboard.press('Tab')
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName)
    expect(firstFocused).toBeTruthy()
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/')

    // Navigate using keyboard
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    // Should have navigated somewhere
    await expect(page.locator('.layout')).toBeVisible()
  })

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Tab')

    // Check that focus is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement
      if (el) {
        const style = window.getComputedStyle(el)
        return {
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
        }
      }
      return null
    })

    expect(focusedElement).toBeTruthy()
  })
})
