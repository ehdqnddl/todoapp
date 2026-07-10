import { test, expect } from '@playwright/test';
import { gotoFresh, addTodo, todoItem } from './helpers.js';

test('새로고침해도 할 일 목록과 완료 상태가 그대로 유지된다', async ({ page }) => {
  await gotoFresh(page);
  await addTodo(page, '유지될 항목', '업무');
  await todoItem(page, '유지될 항목').locator('.todo-checkbox').check();

  await page.reload();

  await expect(todoItem(page, '유지될 항목')).toBeVisible();
  await expect(todoItem(page, '유지될 항목')).toHaveClass(/completed/);
});

test('새로고침해도 선택했던 카테고리 필터가 그대로 유지된다', async ({ page }) => {
  await gotoFresh(page);
  await addTodo(page, '개인 항목', '개인');
  await page.locator('.tab[data-category="개인"]').click();

  await page.reload();

  await expect(page.locator('.tab[data-category="개인"]')).toHaveClass(/active/);
  await expect(todoItem(page, '개인 항목')).toBeVisible();
});
