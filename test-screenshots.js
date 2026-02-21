const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Inject a mock token to bypass login
  await page.addInitScript(() => {
    localStorage.setItem('admin_token', 'test-token-for-screenshot');
  });
  
  await page.goto('http://localhost:8080/admin.html');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Take screenshot of overview
  await page.screenshot({ path: '/tmp/admin-overview.png', fullPage: false });
  console.log('✅ Screenshot saved: /tmp/admin-overview.png');
  
  // Navigate to Email & Leads tab to show import button
  await page.click('[data-tab="email"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/admin-email-tab.png', fullPage: false });
  console.log('✅ Screenshot saved: /tmp/admin-email-tab.png');
  
  // Navigate to Deals tab to show refresh button
  await page.click('[data-tab="deals"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/admin-deals-tab.png', fullPage: false });
  console.log('✅ Screenshot saved: /tmp/admin-deals-tab.png');
  
  // Check sidebar with logout button
  await page.screenshot({ 
    path: '/tmp/admin-sidebar.png', 
    clip: { x: 0, y: 0, width: 350, height: 600 } 
  });
  console.log('✅ Screenshot saved: /tmp/admin-sidebar.png');
  
  await browser.close();
  console.log('\n✅ All screenshots captured successfully!');
})();
