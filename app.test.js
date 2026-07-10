import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

test('generateId returns all-unique values across many calls', () => {
  const ids = new Set(Array.from({ length: 200 }, () => generateId()));
  assert.equal(ids.size, 200);
});

test('generateId falls back to a non-empty string id when crypto.randomUUID is unavailable', () => {
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = undefined;
  try {
    const id = generateId();
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
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

test('saveTodos writes "[]" for an empty list and loadTodos reads it back as an empty array', () => {
  const storage = new FakeStorage();
  saveTodos([], storage);
  assert.equal(storage.getItem(STORAGE_KEY), '[]');
  assert.deepEqual(loadTodos(storage), []);
});

test('saveTodos overwrites a previously saved value', () => {
  const storage = new FakeStorage();
  saveTodos([{ id: '1', text: 'old', category: '업무', completed: false, createdAt: 'x', order: 0 }], storage);
  saveTodos([], storage);
  assert.deepEqual(loadTodos(storage), []);
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

test('addTodo does not add a todo when the category is not one of the valid categories', () => {
  assert.deepEqual(addTodo([], '할 일', '취미'), []);
  assert.deepEqual(addTodo([], '할 일', ''), []);
});

test('addTodo preserves unicode/emoji text exactly', () => {
  const [todo] = addTodo([], '우유 🥛 사기 — 30% 할인', '개인');
  assert.equal(todo.text, '우유 🥛 사기 — 30% 할인');
});

test('addTodo assigns sequentially increasing order across several additions', () => {
  let todos = [];
  todos = addTodo(todos, 'a', '업무');
  todos = addTodo(todos, 'b', '개인');
  todos = addTodo(todos, 'c', '공부');
  assert.deepEqual(todos.map((t) => t.order), [0, 1, 2]);
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

test('updateTodoText only updates the targeted todo, leaving siblings untouched', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  const result = updateTodoText(todos, '1', 'a-수정됨');
  assert.equal(result[0].text, 'a-수정됨');
  assert.equal(result[1].text, 'b');
});

test('updateTodoText preserves unicode/emoji text exactly', () => {
  const todos = [
    { id: '1', text: 'old', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const result = updateTodoText(todos, '1', '점심 🍜 먹기');
  assert.equal(result[0].text, '점심 🍜 먹기');
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

test('deleteTodo removes the only todo in the list, leaving an empty array', () => {
  const todos = [{ id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 }];
  const { todos: result, removed } = deleteTodo(todos, '1');
  assert.deepEqual(result, []);
  assert.equal(removed.index, 0);
});

test('deleteTodo removes the first item correctly', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  const { todos: result } = deleteTodo(todos, '1');
  assert.deepEqual(result.map((t) => t.id), ['2']);
});

test('deleteTodo removes the last item correctly', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  const { todos: result } = deleteTodo(todos, '2');
  assert.deepEqual(result.map((t) => t.id), ['1']);
});

test('restoreTodo on an empty list re-adds the removed todo as the only item', () => {
  const removedTodo = { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 };
  const result = restoreTodo([], { todo: removedTodo, index: 0 });
  assert.deepEqual(result, [removedTodo]);
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

test('toggleTodo applied twice returns the todo to its original state', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  const result = toggleTodo(toggleTodo(todos, '1'), '1');
  assert.deepEqual(result, todos);
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

test('changeTodoCategory is a no-op when the new category is the same as the current one', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.deepEqual(changeTodoCategory(todos, '1', '업무'), todos);
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

test('filterTodosByCategory returns an empty array when nothing matches the category', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.deepEqual(filterTodosByCategory(todos, '공부'), []);
});

test('filterTodosByCategory returns an empty array for an empty list regardless of category', () => {
  assert.deepEqual(filterTodosByCategory([], '전체'), []);
  assert.deepEqual(filterTodosByCategory([], '업무'), []);
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

test('sortTodosForDisplay returns an empty array unchanged', () => {
  assert.deepEqual(sortTodosForDisplay([]), []);
});

test('sortTodosForDisplay leaves an all-completed list order untouched', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: true, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: true, createdAt: 'x', order: 1 },
  ];
  assert.deepEqual(
    sortTodosForDisplay(todos).map((t) => t.id),
    ['1', '2'],
  );
});

test('sortTodosForDisplay leaves an all-incomplete list order untouched', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: false, createdAt: 'x', order: 1 },
  ];
  assert.deepEqual(
    sortTodosForDisplay(todos).map((t) => t.id),
    ['1', '2'],
  );
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

test('computeProgress returns completed === total when everything is completed', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: true, createdAt: 'x', order: 0 },
    { id: '2', text: 'b', category: '업무', completed: true, createdAt: 'x', order: 1 },
  ];
  assert.deepEqual(computeProgress(todos), { completed: 2, total: 2 });
});

test('computeProgress returns completed === 0 when nothing is completed', () => {
  const todos = [
    { id: '1', text: 'a', category: '업무', completed: false, createdAt: 'x', order: 0 },
  ];
  assert.deepEqual(computeProgress(todos), { completed: 0, total: 1 });
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

test('saveFilter then loadFilter round-trips every valid filter value', () => {
  const storage = new FakeStorage();
  for (const filter of ['전체', '업무', '개인', '공부']) {
    saveFilter(filter, storage);
    assert.equal(loadFilter(storage), filter);
  }
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

test('parseImportedTodos rejects an item whose id is not a string', () => {
  const result = parseImportedTodos(JSON.stringify([{ ...validTodo, id: 123 }]));
  assert.equal(result.ok, false);
});

test('parseImportedTodos rejects an item whose order is not a number', () => {
  const result = parseImportedTodos(JSON.stringify([{ ...validTodo, order: '0' }]));
  assert.equal(result.ok, false);
});

test('parseImportedTodos rejects an item whose createdAt is not a string', () => {
  const result = parseImportedTodos(JSON.stringify([{ ...validTodo, createdAt: 12345 }]));
  assert.equal(result.ok, false);
});

test('parseImportedTodos rejects a null entry inside the array', () => {
  const result = parseImportedTodos(JSON.stringify([validTodo, null]));
  assert.equal(result.ok, false);
});

test('parseImportedTodos rejects the literal JSON value "null"', () => {
  const result = parseImportedTodos('null');
  assert.equal(result.ok, false);
});

test('exportTodosAsJson/parseImportedTodos round-trip a large list with unicode and emoji text', () => {
  const todos = Array.from({ length: 50 }, (_, i) => ({
    ...validTodo,
    id: `id-${i}`,
    text: `할 일 ${i} 🎯 — 우선순위 높음`,
    category: ['업무', '개인', '공부'][i % 3],
    completed: i % 2 === 0,
    order: i,
  }));
  const result = parseImportedTodos(exportTodosAsJson(todos));
  assert.equal(result.ok, true);
  assert.deepEqual(result.todos, todos);
});

// --- 시나리오 기반 통합 테스트 (여러 함수를 실제 사용 흐름대로 연결) ---

test('시나리오: 할 일을 추가하고 완료 처리한 뒤 저장하면, 새로고침(재로드) 후에도 완료 상태와 진행률이 그대로 유지된다', () => {
  const storage = new FakeStorage();

  let todos = loadTodos(storage); // 앱 최초 로드 (빈 상태)
  assert.deepEqual(todos, []);

  todos = addTodo(todos, '보고서 작성', '업무');
  todos = addTodo(todos, '병원 예약', '개인');
  saveTodos(todos, storage);

  const [reportTodo] = todos;
  todos = toggleTodo(todos, reportTodo.id);
  saveTodos(todos, storage);

  assert.deepEqual(computeProgress(todos), { completed: 1, total: 2 });

  // 페이지 새로고침을 시뮬레이션: 메모리 상태를 버리고 storage에서 다시 로드
  const reloaded = loadTodos(storage);
  assert.deepEqual(computeProgress(reloaded), { completed: 1, total: 2 });
  assert.equal(reloaded.find((t) => t.id === reportTodo.id).completed, true);
});

test('시나리오: 카테고리별로 필터링한 뒤 완료 처리해도 다른 카테고리 항목은 영향받지 않고, 탭별 진행률이 모두 정확하다', () => {
  let todos = [];
  todos = addTodo(todos, '업무1', '업무');
  todos = addTodo(todos, '업무2', '업무');
  todos = addTodo(todos, '개인1', '개인');

  // "업무" 탭으로 필터링된 화면에서 첫 번째 업무 항목을 완료 처리
  const workView = filterTodosByCategory(todos, '업무');
  const [firstWork] = workView;
  todos = toggleTodo(todos, firstWork.id); // 항상 전체 배열을 대상으로 토글 (실제 앱 동작과 동일)

  assert.deepEqual(computeCategoryProgress(todos, ['전체', '업무', '개인', '공부']), {
    전체: { completed: 1, total: 3 },
    업무: { completed: 1, total: 2 },
    개인: { completed: 0, total: 1 },
    공부: { completed: 0, total: 0 },
  });

  const personalView = filterTodosByCategory(todos, '개인');
  assert.equal(personalView.length, 1);
  assert.equal(personalView[0].completed, false);
});

test('시나리오: 삭제 후 취소(복원)하면 완전히 원래 상태로 돌아오고, 이어서 편집도 정상 동작한다', () => {
  let todos = [];
  todos = addTodo(todos, '장보기', '개인');
  todos = addTodo(todos, '운동하기', '개인');
  const beforeDelete = todos;

  const { todos: afterDelete, removed } = deleteTodo(todos, todos[0].id);
  assert.equal(afterDelete.length, 1);

  const restored = restoreTodo(afterDelete, removed);
  assert.deepEqual(restored, beforeDelete);

  const edited = updateTodoText(restored, removed.todo.id, '장보기 (우유 포함)');
  assert.equal(edited.find((t) => t.id === removed.todo.id).text, '장보기 (우유 포함)');
  assert.equal(edited.length, 2);
});

test('시나리오: 카테고리를 변경하면 완료 상태는 유지된 채 필터/진행률에 즉시 반영된다', () => {
  let todos = [];
  todos = addTodo(todos, '스터디 자료 준비', '공부');
  const [target] = todos;
  todos = toggleTodo(todos, target.id);

  assert.deepEqual(computeCategoryProgress(todos, ['공부', '업무']), {
    공부: { completed: 1, total: 1 },
    업무: { completed: 0, total: 0 },
  });

  todos = changeTodoCategory(todos, target.id, '업무');

  assert.deepEqual(computeCategoryProgress(todos, ['공부', '업무']), {
    공부: { completed: 0, total: 0 },
    업무: { completed: 1, total: 1 },
  });
  assert.equal(todos[0].completed, true, '카테고리 변경이 완료 상태에 영향을 주면 안 된다');
});

test('시나리오: 내보내기 → 데이터 초기화 → 가져오기를 거쳐도 정렬/필터/진행률 결과가 원래와 동일하다', () => {
  let todos = [];
  todos = addTodo(todos, '업무1', '업무');
  todos = addTodo(todos, '업무2', '업무');
  todos = addTodo(todos, '개인1', '개인');
  todos = toggleTodo(todos, todos[0].id);

  const backupJson = exportTodosAsJson(todos);
  const originalDisplay = sortTodosForDisplay(todos).map((t) => t.id);
  const originalProgress = computeProgress(todos);

  todos = []; // 데이터 초기화(예: 브라우저 데이터 삭제 시뮬레이션)

  const { ok, todos: restoredTodos } = parseImportedTodos(backupJson);
  assert.equal(ok, true);
  todos = restoredTodos;

  assert.deepEqual(sortTodosForDisplay(todos).map((t) => t.id), originalDisplay);
  assert.deepEqual(computeProgress(todos), originalProgress);
});

test('시나리오: 완료 항목이 하단에 정렬된 상태에서 새 항목을 추가해도 미완료 항목들 사이에 올바르게 들어간다', () => {
  let todos = [];
  todos = addTodo(todos, 'A', '업무');
  todos = addTodo(todos, 'B', '업무');
  todos = toggleTodo(todos, todos[0].id); // A 완료 처리 → 정렬 시 하단으로

  assert.deepEqual(sortTodosForDisplay(todos).map((t) => t.text), ['B', 'A']);

  todos = addTodo(todos, 'C', '업무'); // 새 미완료 항목 추가

  assert.deepEqual(sortTodosForDisplay(todos).map((t) => t.text), ['B', 'C', 'A']);
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

test('every icon referenced in manifest.json exists on disk', () => {
  const raw = readFileSync(join(__dirname, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(raw);

  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(__dirname, icon.src)), `missing icon file: ${icon.src}`);
  }
});

test('service-worker.js exists and only caches relative app-shell paths', () => {
  const swPath = join(__dirname, 'service-worker.js');
  assert.ok(existsSync(swPath));

  const source = readFileSync(swPath, 'utf-8');
  const shellMatch = source.match(/APP_SHELL\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(shellMatch, 'APP_SHELL array not found in service-worker.js');

  const urls = [...shellMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.ok(!url.startsWith('/'), `APP_SHELL entry should be relative: ${url}`);
  }
});
