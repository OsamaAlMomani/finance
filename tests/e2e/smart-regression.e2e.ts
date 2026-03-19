import { expect, test } from '@playwright/test';
import { installMockElectron, type MockSeed } from './support/mockElectron';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

const activeUserSeed = (overrides: MockSeed = {}): MockSeed => ({
  activeUserId: 'user-reg-1',
  users: [
    {
      id: 'user-reg-1',
      name: 'Regression User',
      activeProfileId: 'profile-main',
      profiles: [{ id: 'profile-main', name: 'Main Profile', created_at: '2026-03-14T00:00:00.000Z' }]
    }
  ],
  ...overrides
});

test.describe('Smart Regression Suite', () => {
  test('[functional][regression] keeps System State collapsed across reload and restores on demand', async ({ page }) => {
    await installMockElectron(page, activeUserSeed());
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System State' })).toBeVisible();

    await page.getByRole('button', { name: /Hide Status/i }).click();
    await expect(page.getByRole('heading', { name: 'System State' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Show Status/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /Show Status/i })).toBeVisible();

    await page.getByRole('button', { name: /Show Status/i }).click();
    await expect(page.getByRole('heading', { name: 'System State' })).toBeVisible();
  });

  test('[functional][regression] quick actions navigate between Alerts, Settlement, and Reports', async ({ page }) => {
    await installMockElectron(page, activeUserSeed());
    await page.goto('/');

    await page.getByRole('button', { name: 'Open Alerts' }).click();
    await expect(page.getByRole('heading', { name: 'System Alerts' })).toBeVisible();

    await page.getByRole('button', { name: 'Open Settlement' }).click();
    await expect(page.getByRole('heading', { name: 'Monthly Settlement' })).toBeVisible();

    await page.getByRole('button', { name: 'Open Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Monthly Reports' })).toBeVisible();
  });

  test('[functional][regression] transaction workflow supports create, tag, search, and filters', async ({ page }) => {
    await installMockElectron(page, activeUserSeed());
    await page.goto('/#/transactions');

    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
    await page.getByRole('button', { name: /Add New/i }).click();

    const modal = page.locator('.fixed.inset-0').first();
    await modal.getByLabel('Amount').fill('89.50');
    await modal.getByLabel('Merchant / Payee').fill('Regression Coffee');
    const tagsField = modal.locator('#tx-tags');
    if (!(await tagsField.isVisible())) {
      await modal.getByRole('button', { name: /advanced|showAdvanced|transactions\.showAdvanced/i }).click();
    }
    await tagsField.fill('coffee,team');
    await modal.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());

    await expect(page.getByText('Regression Coffee')).toBeVisible();
    await page.getByPlaceholder('Search transactions...').fill('Regression Coffee');
    await expect(page.getByRole('row', { name: /Regression Coffee/i })).toBeVisible();

    await page.getByRole('button', { name: /^Filter$/ }).click();
    await page.getByLabel('Transaction Type').selectOption('income');
    await expect(page.getByText('No transactions match your filters.')).toBeVisible();

    await page.getByLabel('Transaction Type').selectOption('expense');
    await expect(page.getByText('Regression Coffee')).toBeVisible();
  });

  test('[functional][regression] settlement to reports to sharing flow remains consistent', async ({ page }) => {
    await installMockElectron(page, activeUserSeed({
      transactions: [
        {
          id: 'tx-flow-1',
          amount: 240,
          date: `${CURRENT_MONTH}-08`,
          merchant: 'Regression Invoice',
          notes: 'Scenario income',
          category_id: 'cat-income',
          account_id: 'acc-checking',
          type: 'income',
          tags: ['flow']
        }
      ]
    }));

    await page.goto('/#/settlement');
    await page.getByRole('button', { name: 'Finalize Month' }).click();
    await expect(page.locator('p', { hasText: 'Status:' })).toContainText(/finalized/i);

    await page.goto('/#/reports');
    await page.getByRole('button', { name: 'Generate from Settled Month' }).click();
    await expect(page.getByRole('button', { name: new RegExp(CURRENT_MONTH) }).first()).toBeVisible();

    await page.goto('/#/sharing');
    await page.getByLabel('Snapshot Name').fill('Board Snapshot');
    await page.getByRole('button', { name: 'Create Snapshot' }).click();

    const snapshotCard = page.locator('.border.rounded.p-3').filter({ hasText: 'Board Snapshot' }).first();
    await expect(snapshotCard).toBeVisible();

    await snapshotCard.getByRole('button', { name: 'Revoke' }).click();
    await expect(snapshotCard).toContainText('Status: revoked');
  });

  test('[functional][regression] design lab CSS tool supports ID, name, and class targeting', async ({ page }) => {
    await installMockElectron(page, activeUserSeed({
      users: [
        {
          id: 'user-reg-1',
          name: 'Lab User',
          activeProfileId: 'profile-lab',
          profiles: [{ id: 'profile-lab', name: 'Design Lab', isLab: true, created_at: '2026-03-14T00:00:00.000Z' }]
        }
      ]
    }));

    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: 'Design Lab (Profile CSS)' })).toBeVisible();

    await page.getByLabel('Target Type').selectOption('id');
    await page.getByLabel('Target Value').fill('lab-selector-value');
    await page.getByLabel('Style Mode').selectOption('text');
    await page.locator('#lab-style-color').fill('#ff0000');
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByRole('button', { name: 'Test CSS' }).click();
    await expect(page.getByText(/^CSS valid:/)).toBeVisible();
    await expect(page.locator('code', { hasText: '#lab-selector-value' })).toBeVisible();

    const idTargetColor = await page.locator('#lab-selector-value').evaluate((el) => getComputedStyle(el as HTMLElement).color);
    expect(idTargetColor).toContain('255, 0, 0');

    await page.getByLabel('Target Type').selectOption('name');
    await page.getByLabel('Target Value').fill('Help');
    await page.getByRole('button', { name: 'Add Rule' }).click();

    await page.getByLabel('Target Type').selectOption('class');
    await page.getByLabel('Target Value').fill('card');
    await page.getByRole('button', { name: 'Add Rule' }).click();

    await page.getByRole('button', { name: 'Test CSS' }).click();
    await expect(page.locator('code', { hasText: '[aria-label="Help"]' })).toBeVisible();
    await expect(page.locator('code', { hasText: '.card' })).toBeVisible();
  });

  test('[functional][regression] permissions enforce disabled actions on Reports and Sharing pages', async ({ page }) => {
    await installMockElectron(page, activeUserSeed({
      users: [
        {
          id: 'user-locked',
          name: 'Viewer User',
          activeProfileId: 'profile-viewer',
          profiles: [{ id: 'profile-viewer', name: 'Viewer Profile', created_at: '2026-03-14T00:00:00.000Z' }]
        }
      ],
      activeUserId: 'user-locked',
      permissions: [
        { id: 'perm-reports-view', scope_type: 'module', scope_id: 'reports', role: 'Viewer', subject_type: 'user', subject_id: 'user-locked', visibility: 'private' },
        { id: 'perm-sharing-view', scope_type: 'module', scope_id: 'sharing', role: 'Viewer', subject_type: 'user', subject_id: 'user-locked', visibility: 'private' }
      ]
    }));

    await page.goto('/#/reports');
    await expect(page.getByText('Report actions are disabled by permissions.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate from Settled Month' })).toBeDisabled();

    await page.goto('/#/sharing');
    await expect(page.getByText('Sharing actions are disabled by permissions.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Snapshot' })).toBeDisabled();
  });
});
