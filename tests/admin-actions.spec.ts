import { test, expect } from '@playwright/test';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

test.skip(!ADMIN_TOKEN, 'Set ADMIN_TOKEN env variable to run admin E2E tests.');

test.describe.serial('Admin V2', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript((token) => {
      localStorage.setItem('admin_token', token as string);
    }, ADMIN_TOKEN);
    await page.goto('/admin.html');
    await page.locator('.admin-nav').waitFor();
  });

  test('Dashboard loads and shows stat cards', async ({ page }) => {
    await expect(page.locator('#stat-total-subscribers')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#stat-clicks-24h')).toBeVisible({ timeout: 10000 });
  });

  test('Tab navigation switches panels', async ({ page }) => {
    await page.locator('[data-tab="newsletter"]').click();
    await expect(page.locator('[data-panel="newsletter"]')).toBeVisible();
    await page.locator('[data-tab="analytics"]').click();
    await expect(page.locator('[data-panel="analytics"]')).toBeVisible();
  });

  test('Logout button clears token and redirects', async ({ page }) => {
    await page.locator('#admin-logout').click();
    await expect(page).toHaveURL(/admin-login/);
  });

  test('Newsletter Export CSV triggers download', async ({ page }) => {
    await page.locator('[data-tab="newsletter"]').click();
    await expect(page.locator('[data-panel="newsletter"]')).toBeVisible();

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/admin-list-subscribers')
    );
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#newsletter-export').click();
    await responsePromise;
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    await expect(page.locator('#toast')).toContainText('Export', { timeout: 10000 });
  });
});

