import { expect, test, type Page } from '@playwright/test';
import { installElectronMock } from './support/mockElectron';

const VISUAL_PROJECTS = new Set(['chromium']);
const FIXED_NOW_ISO = '2026-03-15T12:00:00.000Z';

const escapeHashRoute = (hashRoute: string) => `/${hashRoute.startsWith('#') ? hashRoute : `#${hashRoute}`}`;

const freezeTime = async (page: Page) => {
  await page.addInitScript((isoString) => {
    const fixedEpoch = new Date(isoString as string).valueOf();
    const NativeDate = Date;
    type DateArgTuple =
      | []
      | [number | string]
      | [number, number]
      | [number, number, number]
      | [number, number, number, number]
      | [number, number, number, number, number]
      | [number, number, number, number, number, number]
      | [number, number, number, number, number, number, number];

    class FixedDate extends NativeDate {
      constructor(...args: DateArgTuple) {
        if (args.length === 0) {
          super(fixedEpoch);
          return;
        }
        super(...args);
      }

      static now() {
        return fixedEpoch;
      }
    }

    FixedDate.parse = NativeDate.parse;
    FixedDate.UTC = NativeDate.UTC;
    Object.setPrototypeOf(FixedDate, NativeDate);
    (window as Window & { Date: DateConstructor }).Date = FixedDate as unknown as DateConstructor;
  }, FIXED_NOW_ISO);
};

const stabilizePageForVisuals = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `
  });
};

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!VISUAL_PROJECTS.has(testInfo.project.name), 'Visual baselines are maintained for Chromium projects only.');
  await freezeTime(page);
  await installElectronMock(page);
  await page.goto('/');
  await stabilizePageForVisuals(page);
  await expect(page.locator('.app-body')).toBeVisible();
  await page.waitForLoadState('networkidle');
});

test('dashboard visual baseline', async ({ page }) => {
  await page.goto(escapeHashRoute('#/'));
  await expect(page.locator('.dashboard-page')).toBeVisible();
  await expect(page).toHaveScreenshot('dashboard.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02
  });
});

test('transactions and loans visual baselines', async ({ page }) => {
  await page.goto(escapeHashRoute('#/transactions'));
  await expect(page.locator('.route-workspace')).toBeVisible();
  await expect(page).toHaveScreenshot('transactions.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02
  });

  await page.goto(escapeHashRoute('#/loans'));
  await expect(page.locator('.loans-page')).toBeVisible();
  await expect(page).toHaveScreenshot('loans.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02
  });
});
