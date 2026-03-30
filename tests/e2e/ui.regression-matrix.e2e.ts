import { expect, test } from '@playwright/test';
import { APP_ROUTES, gotoApp, installMockFinanceApp } from './support/mockFinanceApp';

test.describe('App Route Regression Matrix', () => {
  test.beforeEach(async ({ page }) => {
    await installMockFinanceApp(page);
  });

  for (const route of APP_ROUTES) {
    test(`loads ${route.path} and renders ${route.heading}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await gotoApp(page, route.path);

      await expect(page.locator('.app-container')).toBeVisible();
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page.locator('.route-workspace')).toBeVisible();

      await page.waitForTimeout(150);
      expect(pageErrors).toEqual([]);
    });
  }
});
