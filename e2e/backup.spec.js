import { test, expect } from '@playwright/test';
import { gotoFresh, addTodo, todoItem } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('내보내기 버튼을 누르면 유효한 JSON 백업 파일이 다운로드된다', async ({ page }) => {
  await addTodo(page, '백업할 항목', '개인');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#export-button').click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^todos-\d{4}-\d{2}-\d{2}\.json$/);

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const content = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

  expect(content).toHaveLength(1);
  expect(content[0].text).toBe('백업할 항목');
  expect(content[0].category).toBe('개인');
});

test('유효한 백업 파일을 가져오면 확인 후 기존 목록을 덮어쓴다', async ({ page }) => {
  await addTodo(page, '기존 항목', '업무');

  page.once('dialog', (dialog) => dialog.accept());

  const backup = JSON.stringify([
    {
      id: 'r1',
      text: '복원된 항목',
      category: '공부',
      completed: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 0,
    },
  ]);

  await page.setInputFiles('#import-file-input', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf-8'),
  });

  await expect(todoItem(page, '기존 항목')).toHaveCount(0);
  await expect(todoItem(page, '복원된 항목')).toBeVisible();
  await expect(todoItem(page, '복원된 항목')).toHaveClass(/completed/);
});

test('잘못된 형식의 파일을 가져오면 알림을 띄우고 기존 데이터를 보존한다', async ({ page }) => {
  await addTodo(page, '보존되어야 할 항목', '업무');

  let alertMessage = null;
  page.once('dialog', (dialog) => {
    alertMessage = dialog.message();
    dialog.accept();
  });

  await page.setInputFiles('#import-file-input', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('not valid json', 'utf-8'),
  });

  await expect.poll(() => alertMessage).toContain('실패');
  await expect(todoItem(page, '보존되어야 할 항목')).toBeVisible();
});

test('가져오기 확인창에서 취소하면 기존 데이터가 그대로 유지된다', async ({ page }) => {
  await addTodo(page, '유지되어야 할 항목', '업무');

  page.once('dialog', (dialog) => dialog.dismiss());

  const backup = JSON.stringify([
    { id: 'r1', text: '가져올 항목', category: '공부', completed: false, createdAt: '2026-01-01T00:00:00.000Z', order: 0 },
  ]);
  await page.setInputFiles('#import-file-input', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf-8'),
  });

  await expect(todoItem(page, '유지되어야 할 항목')).toBeVisible();
  await expect(todoItem(page, '가져올 항목')).toHaveCount(0);
});
