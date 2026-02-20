import { test, expect } from '@playwright/test';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

test.skip(!ADMIN_TOKEN, 'Set ADMIN_TOKEN env variable to run admin E2E tests.');

test.describe.serial('Admin quick actions', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript((token) => {
      localStorage.setItem('admin_token', token as string);
    }, ADMIN_TOKEN);
    await page.goto('/admin.html');
    await page.locator('.quick-actions').waitFor();
  });

  test('Seed Test Data triggers admin-seed function', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/admin-seed') && response.request().method() === 'POST'
    );
    await page.locator('#seed-data').click();
    const response = await responsePromise;
    expect(response.status(), 'seed endpoint status').toBeLessThan(400);
    await expect(page.locator('#toast')).toContainText('Seed', { timeout: 10000 });
  });

  test('Refresh All issues stats request and succeeds', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/stats')
    );
    await page.locator('#refresh-all').click();
    const response = await responsePromise;
    expect(response.status(), 'stats endpoint status').toBeLessThan(400);
    await expect(page.locator('#toast')).toContainText('Daten aktualisiert', { timeout: 10000 });
  });

  test('Export CSV downloads file', async ({ page }) => {
    // ensure there is data to export
    await page.locator('#seed-data').click();
    await page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/admin-seed')
    );

    const downloadPromise = page.waitForEvent('download');
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/events') && response.request().method() === 'GET'
    );
    await page.locator('#export-csv').click();
    const download = await downloadPromise;
    await responsePromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    await expect(page.locator('#toast')).toContainText('CSV Export', { timeout: 10000 });
  });

  test('Live Mode toggle persists across reload', async ({ page }) => {
    const toggle = page.locator('#toggle-live');
    const initial = await toggle.textContent();
    await toggle.click();
    const toggled = await toggle.textContent();
    expect(toggled).not.toBe(initial);
    await page.reload();
    await expect(toggle).toHaveText(toggled || '', { timeout: 10000 });
    // reset to original state for next runs
    await toggle.click();
  });
});
