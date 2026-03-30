import { expect, test } from '@playwright/test';
import { gotoApp, installMockFinanceApp } from './support/mockFinanceApp';

test.describe('Functional Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await installMockFinanceApp(page);
  });

  test('handles core money workflows across accounts, transactions, budgets, goals, bills, and loans', async ({ page }) => {
    test.slow();

    await gotoApp(page, '/accounts');
    await page.getByRole('button', { name: /add account/i }).click();
    await page.locator('#account-name').fill('Travel Wallet');
    await page.locator('#account-type').selectOption('cash');
    await page.locator('#account-balance').fill('850');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText('Travel Wallet')).toBeVisible();

    await gotoApp(page, '/transactions');
    await page.getByRole('button', { name: /add new/i }).click();
    await page.locator('#tx-date').fill('2026-03-30');
    await page.locator('#tx-amount').fill('67.45');
    await page.locator('#tx-merchant').fill('Regression Coffee');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('Regression Coffee')).toBeVisible();

    await gotoApp(page, '/budget');
    await page.getByRole('button', { name: /create budget/i }).click();
    await page.locator('#budget-category').selectOption({ label: 'Travel' });
    await page.locator('#budget-period').selectOption('monthly');
    await page.locator('#budget-limit').fill('600');
    await page.getByRole('button', { name: /save budget/i }).click();
    await expect(page.getByText('3 monthly budgets active')).toBeVisible();
    await expect(page.getByText('$600.00', { exact: true }).first()).toBeVisible();

    await gotoApp(page, '/goals');
    await page.getByRole('button', { name: /add goal/i }).click();
    await page.locator('#goal-name').fill('Laptop Fund');
    await page.locator('#goal-target').fill('2500');
    await page.locator('#goal-date').fill('2026-10-01');
    await page.locator('#goal-start').fill('250');
    await page.locator('#goal-account').selectOption({ label: 'Main Checking' });
    await page.getByRole('button', { name: /^create$/i }).click();
    const laptopGoalCard = page.locator('.card').filter({ hasText: 'Laptop Fund' }).first();
    await expect(laptopGoalCard).toBeVisible();
    await laptopGoalCard.getByRole('button', { name: /add progress/i }).click();
    await page.locator('#progress-amount').fill('100');
    await page.getByRole('button', { name: /^update$/i }).click();
    await expect(laptopGoalCard.getByText('$350')).toBeVisible();

    await gotoApp(page, '/bills');
    await page.getByRole('button', { name: /add bill/i }).click();
    await page.locator('#bill-name').fill('Streaming Service');
    await page.locator('#bill-amount').fill('19.99');
    await page.locator('#bill-date').fill('2026-04-12');
    await page.locator('#bill-recurrence').selectOption('monthly');
    await page.locator('#bill-name').locator('xpath=ancestor::form').getByRole('button', { name: /^save$/i }).click();
    const streamingBillCard = page.locator('.card').filter({ hasText: 'Streaming Service' }).first();
    await expect(streamingBillCard).toBeVisible();
    await streamingBillCard.getByRole('button', { name: /mark paid/i }).click();
    await expect(streamingBillCard.getByRole('button', { name: /mark unpaid/i })).toBeVisible();

    await gotoApp(page, '/loans');
    const carLoanCard = page.locator('article').filter({ hasText: 'Car Loan' }).first();
    await expect(carLoanCard).toBeVisible();
    await carLoanCard.getByRole('button', { name: /pay/i }).click();
    await expect(carLoanCard.getByText('2 payment(s) logged')).toBeVisible();
    await expect(carLoanCard.getByText('Remaining $7980.00')).toBeVisible();
  });

  test('handles planning, settings, and alert management workflows', async ({ page }) => {
    test.slow();

    await gotoApp(page, '/plans');
    await page.getByRole('button', { name: /create plan/i }).click();
    await page.locator('#plan-title').fill('April debt push');
    await page.locator('#plan-if').fill('Pay an extra 200 toward the car loan.');
    await page.locator('#plan-else').fill('Keep the regular payment only.');
    await page.locator('#plan-whatif').fill('Travel costs rise for one month.');
    await page.locator('#plan-outcome').fill('The loan closes sooner with less interest.');
    await page.locator('#plan-months').fill('2');
    await page.getByRole('button', { name: /create plan/i }).last().click();
    await expect(page.getByText('April debt push')).toBeVisible();

    await gotoApp(page, '/scenarios');
    await page.locator('#planner-title').fill('Regression Snapshot');
    await page.getByRole('button', { name: /save scenario snapshot/i }).click();
    const savedScenario = page.getByText('Regression Snapshot').first();
    await expect(savedScenario).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).first().click();
    await page.getByRole('button', { name: /confirm delete/i }).first().click();
    await expect(savedScenario).toHaveCount(0);

    await gotoApp(page, '/alerts');
    const internetAlertCard = page.locator('.card').filter({ hasText: 'Internet bill is due soon' }).first();
    await expect(internetAlertCard).toBeVisible();
    await internetAlertCard.getByRole('button', { name: /acknowledge/i }).click();
    await expect(internetAlertCard.getByText(/acknowledged/i)).toBeVisible();

    await gotoApp(page, '/settings');
    await page.locator('#newCatName').fill('Pet Care');
    await page.locator('#newCatType').selectOption('expense');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByRole('button', { name: /delete category pet care/i })).toBeVisible();
  });

  test('handles reports, settlement, and sharing workflows', async ({ page }) => {
    test.slow();

    await gotoApp(page, '/reports');
    await page.locator('#report-month').fill('2026-03');
    await page.getByRole('button', { name: /generate from settled month/i }).click();
    await expect(page.getByText('Report generated for 2026-03.')).toBeVisible();
    await page.getByRole('button', { name: /export csv/i }).click();
    await expect(page.getByText('CSV export completed.')).toBeVisible();
    await page.getByRole('button', { name: /export pdf/i }).click();
    await expect(page.getByText('PDF export completed.')).toBeVisible();

    await gotoApp(page, '/settlement');
    await page.locator('#settlement-month').fill('2026-03');
    await page.locator('#settlement-notes').fill('Regression finalization check');
    await page.getByRole('button', { name: /finalize month/i }).click();
    await expect(page.getByText('Settlement finalized successfully.')).toBeVisible();
    await expect(page.getByText(/status: finalized/i)).toBeVisible();
    await page.getByRole('button', { name: /reopen month/i }).click();
    await expect(page.getByText('Settlement reopened successfully.')).toBeVisible();
    await expect(page.getByText(/status: in_review/i)).toBeVisible();

    await gotoApp(page, '/sharing');
    await page.locator('#share-name').fill('QA Snapshot');
    await page.getByRole('button', { name: /create snapshot/i }).click();
    await expect(page.getByText('Sharing link created.')).toBeVisible();
    const snapshotCard = page.locator('.sharing-bridge-card').filter({ hasText: 'QA Snapshot' }).first();
    await expect(snapshotCard).toBeVisible();
    await page.locator('input[placeholder="subject_id"]').fill('qa-user');
    await page.getByRole('button', { name: /save permission/i }).click();
    await expect(page.getByText(/user:qa-user/i)).toBeVisible();
    await snapshotCard.getByRole('button', { name: /revoke/i }).click();
    await expect(snapshotCard.getByText(/revoked/i)).toBeVisible();
  });
});
