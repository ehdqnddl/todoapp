const STORAGE_KEY = 'todos';

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadTodos(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos(todos, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function addTodo(todos, text, category) {
  const trimmed = text.trim();
  if (!trimmed) return todos;
  const newTodo = {
    id: generateId(),
    text: trimmed,
    category,
    completed: false,
    createdAt: new Date().toISOString(),
    order: todos.length,
  };
  return [...todos, newTodo];
}

function updateTodoText(todos, id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return todos;
  return todos.map((todo) => (todo.id === id ? { ...todo, text: trimmed } : todo));
}

function deleteTodo(todos, id) {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) return { todos, removed: null };
  const todo = todos[index];
  const result = [...todos.slice(0, index), ...todos.slice(index + 1)];
  return { todos: result, removed: { todo, index } };
}

function restoreTodo(todos, removed) {
  const index = Math.min(removed.index, todos.length);
  return [...todos.slice(0, index), removed.todo, ...todos.slice(index)];
}

function toggleTodo(todos, id) {
  return todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo));
}

function changeTodoCategory(todos, id, newCategory) {
  if (!VALID_CATEGORIES.includes(newCategory)) return todos;
  return todos.map((todo) => (todo.id === id ? { ...todo, category: newCategory } : todo));
}

function filterTodosByCategory(todos, category) {
  if (category === '전체') return todos;
  return todos.filter((todo) => todo.category === category);
}

function sortTodosForDisplay(todos) {
  return [...todos].sort((a, b) => Number(a.completed) - Number(b.completed));
}

function computeProgress(todos) {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.completed).length;
  return { completed, total };
}

function computeCategoryProgress(todos, categories) {
  const result = {};
  for (const category of categories) {
    result[category] = computeProgress(filterTodosByCategory(todos, category));
  }
  return result;
}

const FILTER_STORAGE_KEY = 'todoFilter';
const VALID_FILTERS = ['전체', '업무', '개인', '공부'];

function loadFilter(storage = localStorage) {
  const raw = storage.getItem(FILTER_STORAGE_KEY);
  return VALID_FILTERS.includes(raw) ? raw : '전체';
}

function saveFilter(filter, storage = localStorage) {
  storage.setItem(FILTER_STORAGE_KEY, filter);
}

const VALID_CATEGORIES = ['업무', '개인', '공부'];

function isValidTodo(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    VALID_CATEGORIES.includes(value.category) &&
    typeof value.completed === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.order === 'number'
  );
}

function exportTodosAsJson(todos) {
  return JSON.stringify(todos, null, 2);
}

function parseImportedTodos(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'not-an-array' };
  }
  if (!parsed.every(isValidTodo)) {
    return { ok: false, error: 'invalid-item' };
  }
  return { ok: true, todos: parsed };
}

let todos = typeof localStorage !== 'undefined' ? loadTodos() : [];

// --- DOM 렌더링 / 이벤트 연결 (브라우저 환경에서만 실행, 수동 검증 대상) ---

if (typeof document !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  const todayDateEl = document.getElementById('today-date');
  const today = new Date();
  todayDateEl.dateTime = today.toISOString().slice(0, 10);
  todayDateEl.textContent = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const todoListEl = document.getElementById('todo-list');
  const emptyStateEl = document.getElementById('empty-state');
  const todoFormEl = document.getElementById('todo-form');
  const textInputEl = todoFormEl.querySelector('.todo-text-input');
  const categorySelectEl = todoFormEl.querySelector('.todo-category-select');
  const snackbarEl = document.getElementById('snackbar');
  const snackbarUndoBtn = document.getElementById('snackbar-undo');
  const categoryTabsEl = document.querySelector('.category-tabs');
  const progressSummaryEl = document.getElementById('progress-summary');
  const progressBarEl = document.getElementById('progress-bar');
  const progressBarFillEl = document.getElementById('progress-bar-fill');
  const exportButtonEl = document.getElementById('export-button');
  const importButtonEl = document.getElementById('import-button');
  const importFileInputEl = document.getElementById('import-file-input');

  let pendingUndo = null; // { removed, timeoutId }
  let currentFilter = loadFilter();

  const renderTodos = (list) => {
    const visible = sortTodosForDisplay(filterTodosByCategory(list, currentFilter));

    todoListEl.innerHTML = '';
    emptyStateEl.hidden = visible.length > 0;

    for (const todo of visible) {
      todoListEl.append(renderTodoItem(todo));
    }

    updateProgressUI(list);
  };

  function updateProgressUI(list) {
    const { completed, total } = computeProgress(list);
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressSummaryEl.textContent = `${completed} / ${total}`;
    progressBarFillEl.style.width = `${percent}%`;
    progressBarEl.setAttribute('aria-valuenow', String(percent));

    const categoryProgress = computeCategoryProgress(list, VALID_FILTERS);
    for (const [category, progress] of Object.entries(categoryProgress)) {
      const countEl = categoryTabsEl.querySelector(`[data-count-for="${category}"]`);
      if (countEl) countEl.textContent = `${progress.completed}/${progress.total}`;
    }
  }

  function setActiveTab() {
    for (const el of categoryTabsEl.querySelectorAll('.tab')) {
      el.classList.toggle('active', el.dataset.category === currentFilter);
    }
  }

  function renderTodoItem(todo) {
    const li = document.createElement('li');
    li.className = 'todo-item';
    if (todo.completed) li.classList.add('completed');
    li.dataset.id = todo.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', '완료 여부');
    checkbox.addEventListener('change', () => handleToggle(todo.id));

    const categorySelect = document.createElement('select');
    categorySelect.className = 'todo-category-tag';
    categorySelect.dataset.category = todo.category;
    categorySelect.setAttribute('aria-label', '카테고리 변경');
    for (const category of VALID_CATEGORIES) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      if (category === todo.category) option.selected = true;
      categorySelect.append(option);
    }
    categorySelect.addEventListener('change', () => handleCategoryChange(todo.id, categorySelect.value));

    const textEl = document.createElement('span');
    textEl.className = 'todo-text';
    textEl.textContent = todo.text;
    textEl.addEventListener('click', () => startEditing(li, todo));
    textEl.addEventListener('dblclick', () => startEditing(li, todo));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-button';
    deleteBtn.setAttribute('aria-label', '삭제');
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => handleDelete(todo.id));

    li.append(checkbox, categorySelect, textEl, deleteBtn);
    return li;
  }

  function handleToggle(id) {
    todos = toggleTodo(todos, id);
    saveTodos(todos);
    renderTodos(todos);
  }

  function handleCategoryChange(id, newCategory) {
    todos = changeTodoCategory(todos, id, newCategory);
    saveTodos(todos);
    renderTodos(todos);
  }

  function startEditing(li, todo) {
    const textEl = li.querySelector('.todo-text');
    if (!textEl) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-edit-input';
    input.value = todo.text;

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      todos = updateTodoText(todos, todo.id, input.value);
      saveTodos(todos);
      renderTodos(todos);
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('blur', commit);

    li.replaceChild(input, textEl);
    input.focus();
    input.select();
  }

  function handleDelete(id) {
    const finishDelete = () => {
      if (pendingUndo) {
        clearTimeout(pendingUndo.timeoutId);
        pendingUndo = null;
      }

      const { todos: next, removed } = deleteTodo(todos, id);
      if (!removed) return;

      todos = next;
      saveTodos(todos);
      renderTodos(todos);
      showUndoSnackbar(removed);
    };

    const li = todoListEl.querySelector(`[data-id="${id}"]`);
    if (li) {
      li.classList.add('removing');
      setTimeout(finishDelete, 180);
    } else {
      finishDelete();
    }
  }

  function showUndoSnackbar(removed) {
    snackbarEl.hidden = false;

    const timeoutId = setTimeout(() => {
      pendingUndo = null;
      snackbarEl.hidden = true;
    }, 5000);

    pendingUndo = { removed, timeoutId };
  }

  snackbarUndoBtn.addEventListener('click', () => {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timeoutId);
    todos = restoreTodo(todos, pendingUndo.removed);
    saveTodos(todos);
    renderTodos(todos);
    pendingUndo = null;
    snackbarEl.hidden = true;
  });

  todoFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = addTodo(todos, textInputEl.value, categorySelectEl.value);
    if (next === todos) return;
    todos = next;
    saveTodos(todos);
    textInputEl.value = '';
    renderTodos(todos);
  });

  categoryTabsEl.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;

    currentFilter = tab.dataset.category;
    saveFilter(currentFilter);
    setActiveTab();
    renderTodos(todos);
  });

  exportButtonEl.addEventListener('click', () => {
    const json = exportTodosAsJson(todos);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todos-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  importButtonEl.addEventListener('click', () => importFileInputEl.click());

  importFileInputEl.addEventListener('change', () => {
    const file = importFileInputEl.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      importFileInputEl.value = '';
      const result = parseImportedTodos(reader.result);
      if (!result.ok) {
        window.alert('가져오기에 실패했습니다: 올바른 백업 파일이 아닙니다.');
        return;
      }
      const confirmed = window.confirm(
        `현재 목록을 백업 파일의 항목 ${result.todos.length}개로 덮어씁니다. 계속할까요?`,
      );
      if (!confirmed) return;

      todos = result.todos;
      saveTodos(todos);
      renderTodos(todos);
    };
    reader.readAsText(file);
  });

  setActiveTab();
  renderTodos(todos);
}

export {
  STORAGE_KEY,
  generateId,
  loadTodos,
  saveTodos,
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
  todos,
};
