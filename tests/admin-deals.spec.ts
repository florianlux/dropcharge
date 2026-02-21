import { test, expect } from '@playwright/test';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

test.skip(!ADMIN_TOKEN, 'Set ADMIN_TOKEN env variable to run admin E2E tests.');

test.describe.serial('Admin Deals Manager', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript((token) => {
      localStorage.setItem('admin_token', token as string);
    }, ADMIN_TOKEN);
    await page.goto('/admin.html');
    await page.locator('.quick-actions').waitFor();
    
    // Navigate to deals tab
    await page.locator('[data-tab="deals"]').click();
    
    // Wait for the deals panel to be visible
    await page.locator('[data-panel="deals"]').waitFor({ state: 'visible' });
  });

  test('Deals table loads data from GET endpoint', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/deals-admin') && 
      response.request().method() === 'GET'
    );
    
    await page.locator('#deals-refresh').click();
    const response = await responsePromise;
    
    expect(response.status()).toBeLessThan(400);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.deals)).toBe(true);
  });

  test('Create deal modal opens and closes', async ({ page }) => {
    const createButton = page.locator('#deals-create');
    const modal = page.locator('#create-deal-modal');
    const closeButton = page.locator('#close-create-modal');
    
    // Modal should be hidden initially
    await expect(modal).not.toHaveClass(/active/);
    
    // Click create button
    await createButton.click();
    await expect(modal).toHaveClass(/active/);
    
    // Close modal
    await closeButton.click();
    await expect(modal).not.toHaveClass(/active/);
  });

  test('Create deal via POST endpoint', async ({ page }) => {
    const createButton = page.locator('#deals-create');
    const modal = page.locator('#create-deal-modal');
    const form = page.locator('#create-deal-form');
    
    // Open modal
    await createButton.click();
    await expect(modal).toHaveClass(/active/);
    
    // Fill form
    await form.locator('[name="title"]').fill(`Test Deal ${Date.now()}`);
    await form.locator('[name="subtitle"]').fill('Test Subtitle');
    await form.locator('[name="description"]').fill('Test Description');
    await form.locator('[name="platform"]').fill('PSN');
    await form.locator('[name="price"]').fill('29,99 €');
    await form.locator('[name="priority"]').fill('100');
    
    // Wait for POST request
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/deals-admin') && 
      response.request().method() === 'POST'
    );
    
    // Submit form
    await page.locator('#submit-create-deal').click();
    
    const response = await responsePromise;
    expect(response.status()).toBeLessThanOrEqual(201);
    
    // Modal should close
    await expect(modal).not.toHaveClass(/active/, { timeout: 5000 });
    
    // Toast should appear
    await expect(page.locator('#toast')).toContainText('erstellt', { timeout: 5000 });
  });

  test('Inline edit uses PATCH endpoint', async ({ page }) => {
    // Wait for deals table to have at least one row
    await page.locator('#deals-table .table-row').first().waitFor({ timeout: 5000 });
    
    const firstRow = page.locator('#deals-table .table-row').first();
    const rowCount = await firstRow.count();
    
    if (rowCount === 0) {
      test.skip(true, 'No deals available for inline edit test');
    }
    
    const titleInput = firstRow.locator('[data-field="title"]');
    const originalValue = await titleInput.inputValue();
    const newValue = `Updated ${Date.now()}`;
    
    // Wait for PATCH request
    const responsePromise = page.waitForResponse((response) =>
      response.url().match(/\/deals-admin\/[^\/]+$/) && 
      response.request().method() === 'PATCH'
    );
    
    await titleInput.fill(newValue);
    await titleInput.blur(); // Trigger change event
    
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(400);
    
    // Toast should appear
    await expect(page.locator('#toast')).toContainText('aktualisiert', { timeout: 5000 });
  });

  test('Toggle active uses PATCH endpoint', async ({ page }) => {
    // Wait for deals table to have at least one row
    await page.locator('#deals-table .table-row').first().waitFor({ timeout: 5000 });
    
    const firstRow = page.locator('#deals-table .table-row').first();
    const rowCount = await firstRow.count();
    
    if (rowCount === 0) {
      test.skip(true, 'No deals available for toggle test');
    }
    
    const toggleButton = firstRow.locator('[data-action="toggle"]');
    
    // Wait for PATCH request
    const responsePromise = page.waitForResponse((response) =>
      response.url().match(/\/deals-admin\/[^\/]+$/) && 
      response.request().method() === 'PATCH'
    );
    
    await toggleButton.click();
    
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(400);
    
    // Toast should appear
    await expect(page.locator('#toast')).toContainText('Status', { timeout: 5000 });
  });

  test('Delete deal uses soft delete (DELETE endpoint)', async ({ page }) => {
    // Wait for deals table to have at least one row
    await page.locator('#deals-table .table-row').first().waitFor({ timeout: 5000 });
    
    const firstRow = page.locator('#deals-table .table-row').first();
    const rowCount = await firstRow.count();
    
    if (rowCount === 0) {
      test.skip(true, 'No deals available for delete test');
    }
    
    const deleteButton = firstRow.locator('[data-action="delete"]');
    
    // Wait for DELETE request
    const responsePromise = page.waitForResponse((response) =>
      response.url().match(/\/deals-admin\/[^\/]+$/) && 
      response.request().method() === 'DELETE'
    );
    
    await deleteButton.click();
    
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(400);
    
    // Toast should appear
    await expect(page.locator('#toast')).toContainText('deaktiviert', { timeout: 5000 });
  });

  test('Deal filters apply correctly', async ({ page }) => {
    const platformFilter = page.locator('#deal-filter-platform');
    const activeFilter = page.locator('#deal-filter-active');
    const applyButton = page.locator('#deals-filter-apply');
    
    // Select filters
    await platformFilter.selectOption('PSN');
    await activeFilter.selectOption('true');
    
    // Wait for GET request with filters
    const responsePromise = page.waitForResponse((response) => {
      const url = response.url();
      return url.includes('/.netlify/functions/deals-admin') && 
             response.request().method() === 'GET' &&
             url.includes('platform=PSN') &&
             url.includes('active=true');
    });
    
    await applyButton.click();
    
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(400);
  });

  test('Optimistic UI shows loading state', async ({ page }) => {
    // Wait for deals table to have at least one row
    await page.locator('#deals-table .table-row').first().waitFor({ timeout: 5000 });
    
    const firstRow = page.locator('#deals-table .table-row').first();
    const rowCount = await firstRow.count();
    
    if (rowCount === 0) {
      test.skip(true, 'No deals available for optimistic UI test');
    }
    
    const toggleButton = firstRow.locator('[data-action="toggle"]');
    
    // Click and immediately check for optimistic class
    await toggleButton.click();
    
    // Row should have optimistic class during request
    await expect(firstRow).toHaveClass(/optimistic/, { timeout: 1000 });
  });
});
