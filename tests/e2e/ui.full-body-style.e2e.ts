import { expect, test } from '@playwright/test';
import { installElectronMock } from './support/mockElectron';

const NAV_TARGETS = [
  { hash: '#/transactions', link: ".sidebar a[href*='#/transactions']" },
  { hash: '#/budget', link: ".sidebar a[href*='#/budget']" },
  { hash: '#/goals', link: ".sidebar a[href*='#/goals']" },
  { hash: '#/bills', link: ".sidebar a[href*='#/bills']" },
  { hash: '#/loans', link: ".sidebar a[href*='#/loans']" },
  { hash: '#/plans', link: ".sidebar a[href*='#/plans']" },
  { hash: '#/scenarios', link: ".sidebar a[href*='#/scenarios']" },
  { hash: '#/settings', link: ".sidebar a[href*='#/settings']" }
];

test.beforeEach(async ({ page }) => {
  await installElectronMock(page);
  await page.goto('/');
  await expect(page.locator('.app-body')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.main-content')).toBeVisible();
});

test('full-body app flow renders across major routes without layout breakage', async ({ page }) => {
  await expect(page).toHaveURL(/(#\/)?$/);

  for (const target of NAV_TARGETS) {
    await page.goto(`/${target.hash}`);
    await expect(page).toHaveURL(new RegExp(`${target.hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.locator('.route-workspace')).toBeVisible();

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      return {
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1,
        appHeight: body.getBoundingClientRect().height,
        viewportHeight: window.innerHeight
      };
    });

    expect(layout.hasHorizontalOverflow).toBe(false);
    expect(layout.appHeight).toBeGreaterThanOrEqual(layout.viewportHeight - 4);
  }
});

test('tailwind/css style contracts hold for cards, buttons, sidebar, and system state bar', async ({ page }) => {
  await page.goto('/#/');

  const cardStyle = await page.locator('.dashboard-page .card').first().evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      borderRadius: parseFloat(style.borderRadius || '0'),
      boxShadow: style.boxShadow,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage
    };
  });

  expect(cardStyle.borderRadius).toBeGreaterThan(6);
  expect(cardStyle.boxShadow).not.toBe('none');
  expect(
    cardStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' || cardStyle.backgroundImage !== 'none'
  ).toBe(true);

  const buttonStyle = await page.locator('.dashboard-page .btn').first().evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      display: style.display,
      borderRadius: parseFloat(style.borderRadius || '0'),
      color: style.color,
      backgroundColor: style.backgroundColor
    };
  });

  expect(['inline-flex', 'flex']).toContain(buttonStyle.display);
  expect(buttonStyle.borderRadius).toBeGreaterThan(8);
  expect(buttonStyle.color).not.toBe(buttonStyle.backgroundColor);

  const sidebarActiveStyle = await page
    .locator(".sidebar .sidebar-nav-link[aria-current='page']")
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      return {
        borderColor: style.borderColor,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter || ''
      };
    });

  expect(sidebarActiveStyle.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(sidebarActiveStyle.backdropFilter).not.toBe('');

  const systemGridStyle = await page.locator('.system-state-grid').evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      display: style.display,
      columnGap: parseFloat(style.columnGap || '0'),
      rowGap: parseFloat(style.rowGap || '0')
    };
  });

  expect(systemGridStyle.display).toBe('grid');
  expect(systemGridStyle.columnGap).toBeGreaterThan(0);
  expect(systemGridStyle.rowGap).toBeGreaterThan(0);
});
