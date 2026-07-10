import { test, expect } from '@playwright/test';
import { gotoFresh, addTodo, todoItem } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('입력 후 Enter로 할 일을 추가하면 목록에 나타나고 입력창이 비워진다', async ({ page }) => {
  await page.locator('.todo-text-input').fill('우유 사기');
  await page.locator('.todo-category-select').selectOption('개인');
  await page.locator('.todo-text-input').press('Enter');

  await expect(todoItem(page, '우유 사기')).toBeVisible();
  await expect(page.locator('.todo-text-input')).toHaveValue('');
  await expect(page.locator('#empty-state')).toBeHidden();
});

test('추가 버튼 클릭으로도 할 일이 추가된다', async ({ page }) => {
  await addTodo(page, '운동하기', '개인');
  await expect(todoItem(page, '운동하기')).toBeVisible();
});

test('빈 값이나 공백만 입력하면 추가되지 않는다', async ({ page }) => {
  await page.locator('.todo-text-input').fill('   ');
  await page.locator('.add-button').click();
  await expect(page.locator('.todo-item')).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
});

test('할 일 텍스트를 클릭하면 인라인 편집 모드로 전환되고 Enter로 저장된다', async ({ page }) => {
  await addTodo(page, '원래 텍스트', '업무');
  await todoItem(page, '원래 텍스트').locator('.todo-text').click();

  const editInput = page.locator('.todo-edit-input');
  await expect(editInput).toBeFocused();
  await editInput.fill('수정된 텍스트');
  await editInput.press('Enter');

  await expect(todoItem(page, '수정된 텍스트')).toBeVisible();
  await expect(page.locator('.todo-edit-input')).toHaveCount(0);
});

test('편집 중 텍스트를 비우고 포커스를 벗어나면 원래 텍스트로 되돌아간다', async ({ page }) => {
  await addTodo(page, '지우면 안 되는 텍스트', '업무');
  await todoItem(page, '지우면 안 되는 텍스트').locator('.todo-text').click();

  const editInput = page.locator('.todo-edit-input');
  await editInput.fill('   ');
  await page.locator('.todo-text-input').click(); // 포커스 아웃 유발

  await expect(todoItem(page, '지우면 안 되는 텍스트')).toBeVisible();
});

test('삭제 버튼을 누르면 즉시 목록에서 사라지고 취소 스낵바가 뜬다', async ({ page }) => {
  await addTodo(page, '삭제될 항목', '업무');
  await todoItem(page, '삭제될 항목').locator('.delete-button').click();

  await expect(todoItem(page, '삭제될 항목')).toHaveCount(0);
  await expect(page.locator('#snackbar')).toBeVisible();
  await expect(page.locator('.snackbar-message')).toContainText('삭제됨');
});

test('스낵바의 취소 버튼을 누르면 삭제한 항목이 원래 위치로 복원된다', async ({ page }) => {
  await addTodo(page, '첫번째', '업무');
  await addTodo(page, '삭제될 항목', '업무');
  await addTodo(page, '세번째', '업무');

  await todoItem(page, '삭제될 항목').locator('.delete-button').click();
  await expect(todoItem(page, '삭제될 항목')).toHaveCount(0);

  await page.locator('#snackbar-undo').click();

  await expect(todoItem(page, '삭제될 항목')).toBeVisible();
  await expect(page.locator('.todo-text')).toHaveText(['첫번째', '삭제될 항목', '세번째']);
});

test('체크박스를 클릭하면 완료 처리되어 취소선이 표시되고 목록 하단으로 정렬된다', async ({ page }) => {
  await addTodo(page, '완료할 항목', '업무');
  await addTodo(page, '미완료 항목', '업무');

  await todoItem(page, '완료할 항목').locator('.todo-checkbox').check();

  await expect(todoItem(page, '완료할 항목')).toHaveClass(/completed/);
  await expect(page.locator('.todo-text')).toHaveText(['미완료 항목', '완료할 항목']);
});
