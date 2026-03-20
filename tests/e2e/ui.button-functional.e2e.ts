import { expect, test, type Page } from '@playwright/test';
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
  '#/settlement',
  '#/reports',
  '#/sharing',
  '#/users',
  '#/settings',
  '#/import-export'
];

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

const isCurrentRoute = (page: Page, expectedHash: string) => {
  const current = new URL(page.url()).hash || '#/';
  return current === expectedHash;
};

const ensureSidebarOpenIfMobile = async (page: Page) => {
  const fab = page.locator('.sidebar-mobile-fab');
  if (await fab.isVisible()) {
    await fab.click();
    await expect(page.locator('.sidebar-backdrop')).toBeVisible();
  }
};

type ButtonCandidate = {
  id: string;
  text: string;
  aria: string;
  title: string;
  type: string;
  disabled: boolean;
};

const collectVisibleButtons = async (page: Page): Promise<ButtonCandidate[]> => {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"], input[type="submit"]')
    );

    const isVisible = (node: HTMLElement) => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };

    const candidates: ButtonCandidate[] = [];
    let index = 0;

    for (const node of nodes) {
      if (!isVisible(node)) continue;

      const id = `e2e-btn-${Date.now()}-${index++}`;
      node.setAttribute('data-e2e-btn-id', id);

      const inputValue = node instanceof HTMLInputElement ? node.value : '';
      const text = (inputValue || node.textContent || '').trim();

      candidates.push({
        id,
        text,
        aria: node.getAttribute('aria-label') || '',
        title: node.getAttribute('title') || '',
        type: node instanceof HTMLInputElement ? node.type || 'input' : node.tagName.toLowerCase(),
        disabled: Boolean((node as HTMLButtonElement).disabled)
      });
    }

    return candidates;
  });
};

test('functional sweep clicks visible buttons across all key pages', async ({ page }) => {
  test.setTimeout(180000);

  await installElectronMock(page);
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/');
  await expect(page.locator('.app-body')).toBeVisible();
  await expect(page.locator('.route-workspace')).toBeVisible();

  const routeClicks: Record<string, number> = {};

  for (const route of ROUTES) {
    await page.goto(`/${route}`);
    await expect(page.locator('.route-workspace')).toBeVisible();

    const visited = new Set<string>();
    let clicks = 0;

    for (let pass = 0; pass < 8; pass += 1) {
      await ensureSidebarOpenIfMobile(page);
      const candidates = await collectVisibleButtons(page);
      let clickedThisPass = 0;

      for (const candidate of candidates) {
        const signature = `${normalizeText(candidate.text)}|${normalizeText(candidate.aria)}|${normalizeText(candidate.title)}|${candidate.type}`;
        if (visited.has(signature)) continue;
        visited.add(signature);

        const searchable = `${normalizeText(candidate.text)} ${normalizeText(candidate.aria)} ${normalizeText(candidate.title)}`;
        if (searchable.includes('logout')) continue;
        if (candidate.disabled) continue;

        const locator = page.locator(`[data-e2e-btn-id="${candidate.id}"]`);
        if ((await locator.count()) === 0) continue;

        try {
          await locator.scrollIntoViewIfNeeded();
          await locator.click({ timeout: 2500 });
          clicks += 1;
          clickedThisPass += 1;
          await page.waitForTimeout(100);
        } catch {
          // Keep sweeping other buttons.
        }

        if (!isCurrentRoute(page, route)) {
          await page.goto(`/${route}`);
          await expect(page.locator('.route-workspace')).toBeVisible();
        }
      }

      if (clickedThisPass === 0) break;
    }

    routeClicks[route] = clicks;
  }

  const totalClicks = Object.values(routeClicks).reduce((sum, value) => sum + value, 0);
  console.table(routeClicks);
  console.log(`Total functional button clicks: ${totalClicks}`);

  expect(totalClicks).toBeGreaterThan(40);
  expect(Object.values(routeClicks).filter((count) => count > 0).length).toBeGreaterThanOrEqual(10);
});
