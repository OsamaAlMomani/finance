import { test, expect, type Page } from '@playwright/test';

type MockUsersPayload = {
  activeUserId: string | null;
  users: Array<{
    id: string;
    name: string;
    activeProfileId?: string;
    profiles?: Array<{ id: string; name: string; isLab?: boolean; created_at?: string }>;
  }>;
};

const installElectronMock = async (page: Page, usersPayload: MockUsersPayload) => {
  await page.addInitScript((seedUsers) => {
    const usersData = structuredClone(seedUsers);

    const ok = () => {};

    const defaultSystemState = (month: string) => ({
      month,
      settlement: {
        status: 'in_review',
        isDirty: false,
        unresolvedCount: 0
      },
      report: {
        status: 'missing',
        generatedAt: null
      },
      alerts: {
        active: 0,
        acknowledged: 0,
        snoozed: 0,
        resolved: 0
      }
    });

    const invoke = async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'user-get-all':
          return usersData;
        case 'user-set-active': {
          const userId = String(args[0] || '');
          usersData.activeUserId = userId || usersData.activeUserId;
          return usersData;
        }
        case 'db-get-dashboard-stats':
          return {
            totalBalance: 1400,
            totalIncome: 2000,
            totalExpense: 600,
            chartData: [
              { date: '2026-03-01', income: 300, expense: 120 },
              { date: '2026-03-02', income: 450, expense: 160 },
              { date: '2026-03-03', income: 380, expense: 200 }
            ],
            activeAlerts: 0
          };
        case 'db-get-categories':
          return [];
        case 'db-get-accounts':
          return [];
        case 'db-get-app-settings':
          return [];
        case 'db-get-accounts-with-balance':
          return [];
        case 'db-get-system-state':
          return defaultSystemState(String(args[0] || '2026-03'));
        case 'window:minimize':
        case 'window:close':
          return undefined;
        case 'window:toggleMaximize':
          return false;
        case 'window:isMaximized':
          return false;
        default:
          return [];
      }
    };

    Object.defineProperty(window, 'electron', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: {
        invoke,
        on: () => ok,
        off: () => ok,
        windowControl: {
          minimize: async () => undefined,
          toggleMaximize: async () => false,
          close: async () => undefined,
          isMaximized: async () => false
        }
      }
    });
  }, usersPayload);
};

test.describe('App Shell Regression', () => {
  test('opens dashboard when a selected user exists', async ({ page }) => {
    await installElectronMock(page, {
      activeUserId: 'user-regression-1',
      users: [
        {
          id: 'user-regression-1',
          name: 'Regression User',
          activeProfileId: 'profile-regression-1',
          profiles: [
            {
              id: 'profile-regression-1',
              name: 'Default Profile',
              created_at: '2026-03-14T00:00:00.000Z'
            }
          ]
        }
      ]
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Regression User')).toBeVisible();
    await expect(page.getByText('System State')).toBeVisible();
  });

  test('opens users page when no selected user exists', async ({ page }) => {
    await installElectronMock(page, {
      activeUserId: null,
      users: []
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create New User' })).toBeVisible();
  });

  test('validates css with the design lab css test tool', async ({ page }) => {
    await installElectronMock(page, {
      activeUserId: 'user-regression-lab',
      users: [
        {
          id: 'user-regression-lab',
          name: 'Lab User',
          activeProfileId: 'profile-regression-lab',
          profiles: [
            {
              id: 'profile-regression-lab',
              name: 'Design Lab',
              isLab: true,
              created_at: '2026-03-14T00:00:00.000Z'
            }
          ]
        }
      ]
    });

    await page.goto('/#/settings');

    await expect(page.getByRole('heading', { name: 'Design Lab (Profile CSS)' })).toBeVisible();
    await page.getByPlaceholder('/* Add custom CSS here */').fill('.card { color: #ff5f5f; }');
    await page.getByRole('button', { name: 'Test CSS' }).click();

    await expect(page.getByText('CSS valid:')).toBeVisible();
    const selectorPanel = page.getByText('Selector Match Results').locator('..');
    await expect(selectorPanel).toBeVisible();
    await expect(selectorPanel.locator('code', { hasText: '.card' })).toBeVisible();
  });
});
