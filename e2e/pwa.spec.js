import { test, expect } from '@playwright/test';
import { gotoFresh } from './helpers.js';

test('manifest.json이 head에 연결되어 있고 필수 필드를 갖는다', async ({ page, baseURL }) => {
  await gotoFresh(page);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe('manifest.json');

  const response = await page.request.get(`${baseURL}/manifest.json`);
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});

test('서비스 워커가 정상적으로 등록되고 활성화된다', async ({ page }) => {
  await gotoFresh(page);

  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg;
  });
  expect(registered).toBe(true);
});

test('도움말 아이콘이 새 탭에서 README로 연결된다', async ({ page }) => {
  await gotoFresh(page);

  const link = page.locator('.help-icon');
  await expect(link).toHaveAttribute('href', /github\.com\/.+#readme/);
  await expect(link).toHaveAttribute('target', '_blank');
});
