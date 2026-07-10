export async function gotoFresh(page) {
  await page.goto('/index.html');
}

export async function addTodo(page, text, category = '업무') {
  await page.locator('.todo-text-input').fill(text);
  await page.locator('.todo-category-select').selectOption(category);
  await page.locator('.add-button').click();
}

export function todoItem(page, text) {
  return page.locator('.todo-item', { has: page.getByText(text, { exact: true }) });
}
