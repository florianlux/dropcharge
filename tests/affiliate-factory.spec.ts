import { test, expect } from '@playwright/test';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

test.skip(!ADMIN_TOKEN, 'Set ADMIN_TOKEN env variable to run admin E2E tests.');

test.describe('Affiliate Link Factory', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript((token) => {
      localStorage.setItem('admin_token', token as string);
    }, ADMIN_TOKEN);
    await page.goto('/admin.html');
    // Navigate to deals tab
    await page.locator('button[data-tab="deals"]').click();
    await page.locator('#factory-form').waitFor();
  });

  test('should validate required fields', async ({ page }) => {
    const submitButton = page.locator('#factory-form button[type="submit"]');
    await submitButton.click();
    
    // HTML5 validation should prevent submission
    const titleInput = page.locator('#factory-form input[name="title"]');
    const isValid = await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('should reject invalid product URLs', async ({ page }) => {
    await page.locator('input[name="title"]').fill('Test Product');
    await page.locator('input[name="product_url"]').fill('not-a-valid-url');
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should accept valid HTTP URL', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `Test Product HTTP ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('input[name="product_url"]').fill('http://example.com/product');
    await page.locator('input[name="platform"]').fill('TEST');
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.slug).toBeTruthy();
    expect(body.go_url).toContain('/go/');
    expect(body.affiliate_url).toContain('example.com');
    
    // Verify result is displayed
    await expect(page.locator('#factory-result')).toContainText('/go/');
  });

  test('should accept valid HTTPS URL', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `Test Product HTTPS ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('input[name="product_url"]').fill('https://example.com/secure-product');
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.affiliate_url).toContain('https://example.com');
  });

  test('should accept URL with existing query parameters', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `Test Product Params ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('input[name="product_url"]').fill('https://example.com/product?existing=param&foo=bar');
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.affiliate_url).toContain('existing=param');
  });

  test('should generate slug from title when not provided', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `Auto Slug Test ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('input[name="product_url"]').fill('https://example.com/product');
    // Leave slug field empty
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.slug).toBeTruthy();
    expect(body.slug).toContain('auto-slug-test');
  });

  test('should use custom slug when provided', async ({ page }) => {
    const timestamp = Date.now();
    const customSlug = `custom-slug-${timestamp}`;
    
    await page.locator('input[name="title"]').fill('Test with Custom Slug');
    await page.locator('input[name="product_url"]').fill('https://example.com/product');
    await page.locator('input[name="slug"]').fill(customSlug);
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.slug).toBe(customSlug);
  });

  test('should handle UTM parameters correctly', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `Test UTM ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('input[name="product_url"]').fill('https://example.com/product');
    await page.locator('input[name="utm_source"]').fill('tiktok');
    await page.locator('input[name="utm_campaign"]').fill('winter-sale');
    await page.locator('input[name="utm_medium"]').fill('social');
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.affiliate_url).toContain('utm_source=tiktok');
    expect(body.affiliate_url).toContain('utm_campaign=winter-sale');
    expect(body.affiliate_url).toContain('utm_medium=social');
  });

  test('should add Amazon affiliate tag for Amazon network', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `Amazon Test ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('select[name="network"]').selectOption('amazon');
    await page.locator('input[name="product_url"]').fill('https://amazon.com/product/B08X123456');
    await page.locator('input[name="tracker_id"]').fill('custom-tag-21');
    
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
    );
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.affiliate_url).toContain('tag=custom-tag-21');
  });

  test('should display result with copy button and preview link', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `UI Test ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('input[name="product_url"]').fill('https://example.com/product');
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    // Wait for result to appear
    await page.locator('#factory-result').waitFor({ state: 'visible' });
    
    // Check for success indicator (contains checkmark and text)
    const resultContent = await page.locator('#factory-result').textContent();
    expect(resultContent).toContain('✓');
    
    // Check for copy button
    const copyButton = page.locator('[data-factory-copy]');
    await expect(copyButton).toBeVisible();
    
    // Check for preview link
    const previewLink = page.locator('[data-factory-preview]');
    await expect(previewLink).toBeVisible();
    await expect(previewLink).toHaveAttribute('target', '_blank');
    
    // Check for affiliate URL copy button
    const copyAffiliateButton = page.locator('[data-factory-copy-affiliate]');
    await expect(copyAffiliateButton).toBeVisible();
  });

  test('should clear form after successful submission', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `Clear Test ${timestamp}`;
    
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('input[name="product_url"]').fill('https://example.com/product');
    await page.locator('input[name="utm_source"]').fill('test-source');
    
    await page.locator('#factory-form button[type="submit"]').click();
    
    // Wait for success
    await page.locator('#factory-result').waitFor({ state: 'visible' });
    
    // Check that form fields are cleared
    const titleValue = await page.locator('input[name="title"]').inputValue();
    const urlValue = await page.locator('input[name="product_url"]').inputValue();
    const utmValue = await page.locator('input[name="utm_source"]').inputValue();
    
    expect(titleValue).toBe('');
    expect(urlValue).toBe('');
    expect(utmValue).toBe('');
  });
});

test.describe('Affiliate Link Factory - URL Validation Unit Tests', () => {
  const invalidUrls = [
    'not-a-url',
    'ftp://example.com',
    'javascript:alert(1)',
    '//example.com',
    'example.com',
    '',
    'htp://typo.com',
  ];

  const validUrls = [
    'http://example.com',
    'https://example.com',
    'https://example.com/path/to/product',
    'https://example.com/product?id=123',
    'https://example.com/product?id=123&ref=abc',
    'https://subdomain.example.com/product',
    'https://example.com:8080/product',
  ];

  for (const url of invalidUrls) {
    test(`should reject invalid URL: "${url}"`, async ({ page }) => {
      await page.goto('/admin.html');
      await page.locator('button[data-tab="deals"]').click();
      await page.locator('#factory-form').waitFor();
      
      await page.locator('input[name="title"]').fill('Test Product');
      await page.locator('input[name="product_url"]').fill(url);
      
      // Try to submit - should fail validation
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/.netlify/functions/affiliate-factory'),
        { timeout: 5000 }
      ).catch(() => null);
      
      await page.locator('#factory-form button[type="submit"]').click();
      
      const response = await responsePromise;
      
      if (response) {
        // If request went through, it should return error status
        expect(response.status()).toBeGreaterThanOrEqual(400);
      } else {
        // Or HTML5 validation prevented submission
        const urlInput = page.locator('input[name="product_url"]');
        const isValid = await urlInput.evaluate((el: HTMLInputElement) => el.validity.valid);
        expect(isValid).toBe(false);
      }
    });
  }

  for (const url of validUrls) {
    test(`should accept valid URL: "${url}"`, async ({ page }) => {
      await page.goto('/admin.html');
      await page.locator('button[data-tab="deals"]').click();
      await page.locator('#factory-form').waitFor();
      
      const timestamp = Date.now();
      await page.locator('input[name="title"]').fill(`Valid URL Test ${timestamp}`);
      await page.locator('input[name="product_url"]').fill(url);
      
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/.netlify/functions/affiliate-factory') && response.request().method() === 'POST'
      );
      
      await page.locator('#factory-form button[type="submit"]').click();
      
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  }
});
