import { expect, test, type Page } from '@playwright/test';
import { disableMotion, gotoApp, installMockFinanceApp } from './support/mockFinanceApp';

const getHorizontalOverflow = async (page: Page) => {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - window.innerWidth);
  });
};

test.describe('Layout And Shell Regression', () => {
  test.beforeEach(async ({ page }) => {
    await installMockFinanceApp(page);
  });

  test('keeps the dashboard shell aligned on desktop', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Layout baselines are tracked in Chromium.');

    await page.setViewportSize({ width: 1440, height: 1100 });
    await gotoApp(page, '/');
    await disableMotion(page);

    await expect(page.locator('.app-container')).toBeVisible();
    await expect(page.locator('.app-body')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main-content')).toBeVisible();

    expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);
  });

  test('keeps budget and settings layouts usable on tablet widths', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Layout baselines are tracked in Chromium.');

    await page.setViewportSize({ width: 980, height: 1180 });
    await gotoApp(page, '/budget');
    await disableMotion(page);
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
    expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

    await gotoApp(page, '/settings');
    await expect(page.getByRole('heading', { name: 'App Settings' })).toBeVisible();
    expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);
  });
});
