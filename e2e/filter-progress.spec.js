import { test, expect } from '@playwright/test';
import { gotoFresh, addTodo, todoItem } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('카테고리 탭을 클릭하면 해당 카테고리만 표시되고 활성 탭이 표시된다', async ({ page }) => {
  await addTodo(page, '업무 항목', '업무');
  await addTodo(page, '개인 항목', '개인');

  await page.locator('.tab[data-category="업무"]').click();

  await expect(todoItem(page, '업무 항목')).toBeVisible();
  await expect(todoItem(page, '개인 항목')).toHaveCount(0);
  await expect(page.locator('.tab[data-category="업무"]')).toHaveClass(/active/);
  await expect(page.locator('.tab[data-category="전체"]')).not.toHaveClass(/active/);
});

test('진행률 텍스트와 프로그레스 바가 완료 개수에 맞춰 갱신된다', async ({ page }) => {
  await addTodo(page, 'A', '업무');
  await addTodo(page, 'B', '업무');

  await expect(page.locator('#progress-summary')).toHaveText('0 / 2');

  await todoItem(page, 'A').locator('.todo-checkbox').check();

  await expect(page.locator('#progress-summary')).toHaveText('1 / 2');
  const width = await page.locator('#progress-bar-fill').evaluate((el) => el.style.width);
  expect(width).toBe('50%');
});

test('탭마다 완료/전체 개수가 정확히 표시된다', async ({ page }) => {
  await addTodo(page, '업무1', '업무');
  await addTodo(page, '업무2', '업무');
  await addTodo(page, '개인1', '개인');
  await todoItem(page, '업무1').locator('.todo-checkbox').check();

  await expect(page.locator('.tab-count[data-count-for="전체"]')).toHaveText('1/3');
  await expect(page.locator('.tab-count[data-count-for="업무"]')).toHaveText('1/2');
  await expect(page.locator('.tab-count[data-count-for="개인"]')).toHaveText('0/1');
  await expect(page.locator('.tab-count[data-count-for="공부"]')).toHaveText('0/0');
});

test('항목의 카테고리 드롭다운을 바꾸면 태그 색상과 탭 카운트가 즉시 갱신된다', async ({ page }) => {
  await addTodo(page, '카테고리 바꿀 항목', '업무');

  const select = todoItem(page, '카테고리 바꿀 항목').locator('.todo-category-tag');
  await select.selectOption('공부');

  await expect(select).toHaveAttribute('data-category', '공부');
  await expect(page.locator('.tab-count[data-count-for="업무"]')).toHaveText('0/0');
  await expect(page.locator('.tab-count[data-count-for="공부"]')).toHaveText('0/1');
});
