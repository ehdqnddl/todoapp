import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  generateId,
  loadTodos,
  saveTodos,
  STORAGE_KEY,
  addTodo,
  updateTodoText,
  deleteTodo,
  restoreTodo,
  toggleTodo,
  changeTodoCategory,
  filterTodosByCategory,
  sortTodosForDisplay,
  computeProgress,
  computeCategoryProgress,
  FILTER_STORAGE_KEY,
  loadFilter,
  saveFilter,
  exportTodosAsJson,
  parseImportedTodos,
} from './app.js';

class FakeStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
}

test('generateId returns a non-empty string', () => {
  const id = generateId();
  assert.equal(typeof id, 'string');
  assert.ok(id.length > 0);
});

test('generateId returns a different value on each call', () => {
  const id1 = generateId();
  const id2 = generateId();
  assert.notEqual(id1, id2);
});

test('loadTodos returns an empty array when storage has no "todos" key', () => {
  const storage = new FakeStorage();
  assert.deepEqual(loadTodos(storage), []);
});

test('loadTodos parses and returns a stored todos array', () => {
  const storage = new FakeStorage();
  const todos = [
    {
      id: '1',
      text: 'test',
      category: '업무',
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 0,
    },
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(todos));
  assert.deepEqual(loadTodos(storage), todos);
});

test('loadTodos returns an empty array when the stored value is invalid JSON', () => {
  const storage = new FakeStorage();
  storage.setItem(STORAGE_KEY, '{not valid json');
  assert.deepEqual(loadTodos(storage), []);
});

test('loadTodos returns an empty array when the stored value is not an array', () => {
  const storage = new FakeStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
  assert.deepEqual(loadTodos(storage), []);
});

test('saveTodos writes the todos array as JSON under the "todos" key', () => {
  const storage = new FakeStorage();
  const todos = [
    {
      id: '1',
      text: 'test',
      category: '개인',
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 0,
    },
  ];
  saveTodos(todos, storage);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(todos));
});

test('saveTodos then loadTodos round-trips the same data', () => {
  const storage = new FakeStorage();
  const todos = [
    {
      id: '1',
      text: 'a',
      category: '공부',
      completed: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 0,
    },
  ];
  saveTodos(todos, storage);
  assert.deepEqual(loadTodos(storage), todos);
});

// --- addTodo ---

test('addTodo appends a new todo with the given text and category', () => {
  const result = addTodo([], '우유 사기', '개인');
  assert.equal(result.length, 1);
  const [todo] = result;
  assert.equal(todo.text, '우유 사기');
  assert.equal(todo.category, '개인');
  assert.equal(todo.completed, false);
  assert.equal(typeof todo.id, 'string');
  assert.ok(todo.id.length > 0);
  assert.ok(!Number.isNaN(Date.parse(todo.createdAt)));
});

test('addTodo trims surrounding whitespace from the text', () => {
  const [todo] = addTodo([], '  운동하기  ', '개인');
  assert.equal(todo.text, '운동하기');
});

test('addTodo assigns an incrementing order after existing todos', () => {
  const existing = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  const result = addTodo(existing, 'c', '업무');
  assert.equal(result.length, 3);
  assert.equal(result[2].order, 2);
});

test('addTodo does not add a todo when the text is empty or whitespace-only', () => {
  assert.deepEqual(addTodo([], '', '업무'), []);
  assert.deepEqual(addTodo([], '   ', '업무'), []);
});

test('addTodo does not mutate the original array', () => {
  const original = [];
  addTodo(original, '할 일', '업무');
  assert.deepEqual(original, []);
});

// --- updateTodoText ---

test('updateTodoText updates the text of the matching todo', () => {
  const todos = [
    { id: '1', text: 'old', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const result = updateTodoText(todos, '1', 'new');
  assert.equal(result[0].text, 'new');
});

test('updateTodoText trims the new text', () => {
  const todos = [
    { id: '1', text: 'old', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const result = updateTodoText(todos, '1', '  new  ');
  assert.equal(result[0].text, 'new');
});

test('updateTodoText keeps the original text when the new text is empty or whitespace-only', () => {
  const todos = [
    { id: '1', text: 'old', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.equal(updateTodoText(todos, '1', '')[0].text, 'old');
  assert.equal(updateTodoText(todos, '1', '   ')[0].text, 'old');
});

test('updateTodoText leaves the array unchanged when the id does not exist', () => {
  const todos = [
    { id: '1', text: 'old', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.deepEqual(updateTodoText(todos, 'missing', 'new'), todos);
});

// --- deleteTodo / restoreTodo ---

test('deleteTodo removes the matching todo and returns it with its original index', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
    { id: '3', text: 'c', category: '업무', completed: false, createdAt: 'x', order: 2 },
  ];
  const { todos: result, removed } = deleteTodo(todos, '2');
  assert.deepEqual(result.map((t) => t.id), ['1', '3']);
  assert.equal(removed.index, 1);
  assert.equal(removed.todo.id, '2');
});

test('deleteTodo returns removed: null and the same todos when the id does not exist', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const { todos: result, removed } = deleteTodo(todos, 'missing');
  assert.deepEqual(result, todos);
  assert.equal(removed, null);
});

test('restoreTodo reinserts the removed todo at its original index', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '3', text: 'c', category: '업무', completed: false, createdAt: 'x', order: 2 },
  ];
  const removedTodo = { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 };
  const result = restoreTodo(todos, { todo: removedTodo, index: 1 });
  assert.deepEqual(result.map((t) => t.id), ['1', '2', '3']);
});

test('restoreTodo appends at the end when the original index is beyond the current length', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const removedTodo = { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 };
  const result = restoreTodo(todos, { todo: removedTodo, index: 5 });
  assert.deepEqual(result.map((t) => t.id), ['1', '2']);
});

// --- toggleTodo ---

test('toggleTodo flips completed from false to true for the matching todo', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const result = toggleTodo(todos, '1');
  assert.equal(result[0].completed, true);
});

test('toggleTodo flips completed from true to false for the matching todo', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: true, createdAt: 'x', order: 0 },
  ];
  const result = toggleTodo(todos, '1');
  assert.equal(result[0].completed, false);
});

test('toggleTodo leaves other todos untouched', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  const result = toggleTodo(todos, '1');
  assert.equal(result[1].completed, false);
});

test('toggleTodo leaves the array unchanged when the id does not exist', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.deepEqual(toggleTodo(todos, 'missing'), todos);
});

// --- changeTodoCategory ---

test('changeTodoCategory updates the category of the matching todo', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const result = changeTodoCategory(todos, '1', '개인');
  assert.equal(result[0].category, '개인');
});

test('changeTodoCategory leaves other todos untouched', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  const result = changeTodoCategory(todos, '1', '공부');
  assert.equal(result[1].category, '업무');
});

test('changeTodoCategory leaves the array unchanged when the id does not exist', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.deepEqual(changeTodoCategory(todos, 'missing', '개인'), todos);
});

test('changeTodoCategory leaves the array unchanged when the new category is invalid', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.deepEqual(changeTodoCategory(todos, '1', '취미'), todos);
});

// --- filterTodosByCategory ---

test('filterTodosByCategory returns all todos when the category is "전체"', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '개인', completed: false, createdAt: 'x', order: 1 },
  ];
  assert.deepEqual(filterTodosByCategory(todos, '전체'), todos);
});

test('filterTodosByCategory returns only todos matching the given category', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '개인', completed: false, createdAt: 'x', order: 1 },
    { id: '3', text: 'c', category: '업무', completed: false, createdAt: 'x', order: 2 },
  ];
  assert.deepEqual(
    filterTodosByCategory(todos, '업무').map((t) => t.id),
    ['1', '3'],
  );
});

// --- sortTodosForDisplay ---

test('sortTodosForDisplay moves completed todos to the bottom', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: true, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
    { id: '3', text: 'c', category: '업무', completed: true, createdAt: 'x', order: 2 },
    { id: '4', text: 'd', category: '업무', completed: false, createdAt: 'x', order: 3 },
  ];
  assert.deepEqual(
    sortTodosForDisplay(todos).map((t) => t.id),
    ['2', '4', '1', '3'],
  );
});

test('sortTodosForDisplay preserves relative order within each group', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  assert.deepEqual(
    sortTodosForDisplay(todos).map((t) => t.id),
    ['1', '2'],
  );
});

test('sortTodosForDisplay does not mutate the original array', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: true, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  const original = [...todos];
  sortTodosForDisplay(todos);
  assert.deepEqual(todos, original);
});

// --- computeProgress ---

test('computeProgress returns 0/0 for an empty list', () => {
  assert.deepEqual(computeProgress([]), { completed: 0, total: 0 });
});

test('computeProgress counts completed and total todos', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: true, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
    { id: '3', text: 'c', category: '업무', completed: true, createdAt: 'x', order: 2 },
  ];
  assert.deepEqual(computeProgress(todos), { completed: 2, total: 3 });
});

// --- computeCategoryProgress ---

test('computeCategoryProgress returns progress per category, including "전체" as the overall total', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: true, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
    { id: '3', text: 'c', category: '개인', completed: true, createdAt: 'x', order: 2 },
  ];
  assert.deepEqual(computeCategoryProgress(todos, ['전체', '업무', '개인', '공부']), {
    전체: { completed: 2, total: 3 },
    업무: { completed: 1, total: 2 },
    개인: { completed: 1, total: 1 },
    공부: { completed: 0, total: 0 },
  });
});

// --- loadFilter / saveFilter ---

test('loadFilter returns "전체" when storage has no filter saved', () => {
  const storage = new FakeStorage();
  assert.equal(loadFilter(storage), '전체');
});

test('loadFilter returns the saved filter value', () => {
  const storage = new FakeStorage();
  storage.setItem(FILTER_STORAGE_KEY, '업무');
  assert.equal(loadFilter(storage), '업무');
});

test('loadFilter falls back to "전체" for an unrecognized saved value', () => {
  const storage = new FakeStorage();
  storage.setItem(FILTER_STORAGE_KEY, '알수없음');
  assert.equal(loadFilter(storage), '전체');
});

test('saveFilter writes the filter value under the filter storage key', () => {
  const storage = new FakeStorage();
  saveFilter('공부', storage);
  assert.equal(storage.getItem(FILTER_STORAGE_KEY), '공부');
});

// --- exportTodosAsJson / parseImportedTodos ---

const validTodo = {
  id: '1',
  text: 'a',
  category: '업무',
  completed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  order: 0,
};

test('exportTodosAsJson returns a JSON string that round-trips through parseImportedTodos', () => {
  const todos = [validTodo, { ...validTodo, id: '2', completed: true }];
  const json = exportTodosAsJson(todos);
  const result = parseImportedTodos(json);
  assert.equal(result.ok, true);
  assert.deepEqual(result.todos, todos);
});

test('exportTodosAsJson returns "[]" for an empty list', () => {
  assert.equal(exportTodosAsJson([]), '[]');
});

test('parseImportedTodos rejects invalid JSON text', () => {
  const result = parseImportedTodos('{not valid json');
  assert.equal(result.ok, false);
});

test('parseImportedTodos rejects a JSON value that is not an array', () => {
  const result = parseImportedTodos(JSON.stringify({ foo: 'bar' }));
  assert.equal(result.ok, false);
});

test('parseImportedTodos accepts an empty array', () => {
  const result = parseImportedTodos('[]');
  assert.equal(result.ok, true);
  assert.deepEqual(result.todos, []);
});

test('parseImportedTodos rejects an item missing a required field', () => {
  const { text, ...withoutText } = validTodo;
  const result = parseImportedTodos(JSON.stringify([withoutText]));
  assert.equal(result.ok, false);
});

test('parseImportedTodos rejects an item with an invalid category', () => {
  const result = parseImportedTodos(JSON.stringify([{ ...validTodo, category: '취미' }]));
  assert.equal(result.ok, false);
});

test('parseImportedTodos rejects an item whose completed field is not a boolean', () => {
  const result = parseImportedTodos(JSON.stringify([{ ...validTodo, completed: 'yes' }]));
  assert.equal(result.ok, false);
});

// --- manifest.json (PWA) ---

const __dirname = dirname(fileURLToPath(import.meta.url));

test('manifest.json is valid JSON with the required PWA fields', () => {
  const raw = readFileSync(join(__dirname, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(raw);

  assert.equal(typeof manifest.name, 'string');
  assert.equal(manifest.display, 'standalone');
  assert.equal(typeof manifest.start_url, 'string');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
});

test('manifest.json only uses relative paths (safe under a GitHub Pages subpath)', () => {
  const raw = readFileSync(join(__dirname, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(raw);

  assert.ok(!manifest.start_url.startsWith('/'));
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'));
  }
});
