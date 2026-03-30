import { expect, test } from '@playwright/test';
import { gotoApp, installMockFinanceApp } from './support/mockFinanceApp';

const multiUserSeed = {
  activeUserId: 'user_main',
  users: [
    {
      id: 'user_main',
      name: 'Osama',
      avatar: 'avatar-01',
      activeProfileId: 'profile_main',
      profiles: [
        { id: 'profile_main', name: 'Main Profile', isLab: false },
        { id: 'profile_lab', name: 'Design Lab', isLab: true }
      ]
    },
    {
      id: 'user_alt',
      name: 'Maya',
      avatar: 'avatar-02',
      activeProfileId: 'profile_alt_main',
      profiles: [
        { id: 'profile_alt_main', name: 'Travel Profile', isLab: false },
        { id: 'profile_alt_lab', name: 'Design Lab', isLab: true }
      ]
    }
  ]
};

test.describe('Deep Regression Workflows', () => {
  test('round-trips a full backup through export, reset, and import restore', async ({ page }) => {
    await installMockFinanceApp(page);

    await gotoApp(page, '/transactions');
    await expect(page.getByText('Primary Employer')).toBeVisible();

    await gotoApp(page, '/import-export');
    await page.getByRole('button', { name: /full backup \(zip\)/i }).click();
    await page.getByRole('button', { name: /export & reset data/i }).click();
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect(page.getByText(/all data has been reset/i)).toBeVisible();

    await gotoApp(page, '/transactions');
    await expect(page.getByText('Primary Employer')).toHaveCount(0);

    await gotoApp(page, '/import-export');
    await page.getByRole('button', { name: /full backup \(zip\)/i }).click();
    await page.getByRole('button', { name: /import backup zip/i }).click();
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect(page.getByText(/backup imported successfully/i)).toBeVisible();

    await gotoApp(page, '/transactions');
    await expect(page.getByText('Primary Employer')).toBeVisible();

    await gotoApp(page, '/accounts');
    await expect(page.getByText('Main Checking').first()).toBeVisible();
  });

  test('keeps active user and profile bootstrap state aligned with Electron identity changes', async ({ page }) => {
    await installMockFinanceApp(page, { seed: multiUserSeed });

    await gotoApp(page, '/settings');
    await expect(page.locator('.titlebar-user')).toHaveText(/osama/i);
    await expect(page.locator('#lab-selector-mode')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('authUserId'))).toBe('user_main');

    await page.evaluate(() =>
      (window as Window & { electron: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).electron.invoke(
        'user-set-active',
        'user_alt'
      )
    );
    await page.reload();
    await gotoApp(page, '/settings');

    await expect(page.locator('.titlebar-user')).toHaveText(/maya/i);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('authUserId'))).toBe('user_alt');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('activeProfileId'))).toBe('profile_alt_main');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('activeProfileIsLab'))).toBe('0');

    await page.evaluate(() =>
      (window as Window & { electron: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).electron.invoke(
        'profile-set-active',
        'user_alt',
        'profile_alt_lab'
      )
    );
    await page.reload();
    await gotoApp(page, '/settings');

    await expect(page.locator('.titlebar-user')).toHaveText(/maya/i);
    await expect(page.locator('#lab-selector-mode')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('activeProfileId'))).toBe('profile_alt_lab');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('activeProfileIsLab'))).toBe('1');
  });
});
