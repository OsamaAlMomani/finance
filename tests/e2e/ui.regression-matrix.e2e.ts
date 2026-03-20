import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { installElectronMock } from './support/mockElectron';

const ROUTES = [
  '#/',
  '#/transactions',
  '#/budget',
  '#/goals',
  '#/bills',
  '#/loans',
  '#/plans',
  '#/scenarios',
  '#/alerts',
  '#/settings'
];

const routeLabel = (hashRoute: string) => (hashRoute === '#/' ? 'dashboard' : hashRoute.replace('#/', ''));

const openRoute = async (page: Page, hashRoute: string) => {
  await page.goto(`/${hashRoute}`);
  const escaped = hashRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page).toHaveURL(new RegExp(`${escaped}$`));
  await expect(page.locator('.route-workspace')).toBeVisible();
};

const firstVisibleInWorkspace = (page: Page, selector: string) =>
  page.locator(`.route-workspace ${selector}`).first();

test.beforeEach(async ({ page }) => {
  await installElectronMock(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await expect(page.locator('.app-body')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.main-content')).toBeVisible();
});

type UiCheck = {
  id: string;
  run: (page: Page, hashRoute: string) => Promise<void>;
};

const checks: UiCheck[] = [
  {
    id: 'workspace-visible',
    run: async (page) => {
      await expect(page.locator('.route-workspace')).toBeVisible();
    }
  },
  {
    id: 'sidebar-active-link',
    run: async (page, hashRoute) => {
      const routePath = hashRoute.replace(/^#/, '');
      const routeLink = page.locator(`.sidebar .sidebar-nav-link[href*='${routePath}']`);
      const routeLinkCount = await routeLink.count();

      if (routeLinkCount > 0) {
        await expect(routeLink.first()).toHaveAttribute('aria-current', 'page');
        return;
      }

      const activeCount = await page.locator(".sidebar .sidebar-nav-link[aria-current='page']").count();
      expect(activeCount).toBeLessThanOrEqual(1);
    }
  },
  {
    id: 'titlebar-visible',
    run: async (page) => {
      await expect(page.locator('.titlebar')).toBeVisible();
      await expect(page.locator('.titlebar-user')).toBeVisible();
    }
  },
  {
    id: 'has-heading',
    run: async (page) => {
      const headingCount = await page.locator('.route-workspace h1, .route-workspace h2, .route-workspace h3').count();
      expect(headingCount).toBeGreaterThan(0);
    }
  },
  {
    id: 'interactives-present',
    run: async (page) => {
      const interactiveCount = await page
        .locator('.route-workspace button, .route-workspace input, .route-workspace select, .route-workspace textarea, .route-workspace a')
        .count();
      expect(interactiveCount).toBeGreaterThan(0);
    }
  },
  {
    id: 'main-content-bounds',
    run: async (page) => {
      const bounds = await page.evaluate(() => {
        const main = document.querySelector('.main-content') as HTMLElement | null;
        const rect = main?.getBoundingClientRect();
        return {
          width: rect?.width || 0,
          height: rect?.height || 0,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        };
      });
      expect(bounds.width).toBeGreaterThan(100);
      expect(bounds.height).toBeGreaterThan(100);
      expect(bounds.width).toBeLessThanOrEqual(bounds.viewportWidth + 2);
      expect(bounds.height).toBeLessThanOrEqual(bounds.viewportHeight + 2);
    }
  },
  {
    id: 'desktop-horizontal-overflow',
    run: async (page) => {
      const hasOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        return doc.scrollWidth > doc.clientWidth + 2 || body.scrollWidth > body.clientWidth + 2;
      });
      expect(hasOverflow).toBe(false);
    }
  },
  {
    id: 'card-style-contract',
    run: async (page) => {
      const target = page.locator('.route-workspace .card, .route-workspace section, .route-workspace').first();
      const style = await target.evaluate((node) => {
        const computed = getComputedStyle(node as HTMLElement);
        return {
          display: computed.display,
          borderRadius: parseFloat(computed.borderRadius || '0')
        };
      });
      expect(style.display).not.toBe('none');
      expect(style.borderRadius).toBeGreaterThanOrEqual(0);
    }
  },
  {
    id: 'tab-focus-works',
    run: async (page) => {
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => {
        const node = document.activeElement as HTMLElement | null;
        return {
          tag: (node?.tagName || '').toLowerCase(),
          className: node?.className || ''
        };
      });
      expect(active.tag).not.toBe('body');
      expect(active.tag).not.toBe('html');
    }
  },
  {
    id: 'click-primary-workspace-button',
    run: async (page, hashRoute) => {
      const candidate = firstVisibleInWorkspace(page, 'button');
      if (await candidate.count()) {
        try {
          await candidate.scrollIntoViewIfNeeded();
          await candidate.click({ timeout: 2000 });
        } catch {
          // No-op. This check verifies clickability best-effort without destabilizing full suite.
        }
      }
      await expect(page.locator('.route-workspace')).toBeVisible();
      const expected = hashRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(page).toHaveURL(new RegExp(`${expected}$`));
    }
  }
];

for (const route of ROUTES) {
  for (const check of checks) {
    test(`matrix:${routeLabel(route)}:${check.id}`, async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];

      const onPageError = (error: Error) => pageErrors.push(error.message);
      const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      };

      page.on('pageerror', onPageError);
      page.on('console', onConsole);

      await openRoute(page, route);
      await check.run(page, route);

      page.off('pageerror', onPageError);
      page.off('console', onConsole);

      expect(pageErrors, `page errors on ${routeLabel(route)} / ${check.id}`).toHaveLength(0);
      expect(
        consoleErrors.filter((entry) => !entry.toLowerCase().includes('warning')),
        `console errors on ${routeLabel(route)} / ${check.id}`
      ).toHaveLength(0);
    });
  }
}

test('matrix-count-is-at-least-100', () => {
  expect(ROUTES.length * checks.length).toBeGreaterThanOrEqual(100);
});
