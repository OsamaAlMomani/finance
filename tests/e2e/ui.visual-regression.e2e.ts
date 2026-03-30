import { expect, test } from '@playwright/test';
import { disableMotion, gotoApp, installMockFinanceApp } from './support/mockFinanceApp';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await installMockFinanceApp(page);
    await page.setViewportSize({ width: 1440, height: 1280 });
  });

  test('dashboard remains visually stable', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baselines are tracked in Chromium.');

    await gotoApp(page, '/');
    await disableMotion(page);
    await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0);

    await expect(page).toHaveScreenshot('dashboard-page.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.02
    });
  });

  test('goals page remains visually stable', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baselines are tracked in Chromium.');

    await gotoApp(page, '/goals');
    await disableMotion(page);

    await expect(page).toHaveScreenshot('goals-page.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.02
    });
  });

  test('reports page remains visually stable', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baselines are tracked in Chromium.');

    await gotoApp(page, '/reports');
    await disableMotion(page);

    await expect(page).toHaveScreenshot('reports-page.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.02
    });
  });
});
