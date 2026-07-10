import { test, expect } from '@playwright/test';

test('smoke: page loads and shows the empty state', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#empty-state')).toBeVisible();
});
