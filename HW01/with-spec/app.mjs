// Связывает чистую логику из domain.mjs с DOM.
// Состояние в памяти — источник истины; интерфейс перерисовывается из него.

import {
  createInitialTasks,
  validateTaskInput,
  addTask,
  removeTask,
  toggleTask,
  totalHours,
  doneHours,
  progress,
  filterTasks,
} from './domain.mjs';

const STORAGE_KEY = 'build-tracker.tasks';

// --- Состояние ---
let tasks = createInitialTasks();
let currentFilter = 'all';
let storageWarning = '';

// --- Необязательное сохранение в localStorage ---
function isValidTask(task) {
  return (
    task &&
    typeof task === 'object' &&
    Number.isFinite(task.id) &&
    typeof task.title === 'string' &&
    Number.isFinite(task.hours) &&
    typeof task.done === 'boolean'
  );
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isValidTask)) {
      throw new Error('Повреждённые данные');
    }
    tasks = parsed;
  } catch (error) {
    // Хранилище недоступно или данные повреждены — продолжаем в памяти.
    storageWarning = 'Хранилище недоступно: изменения не сохраняются, работа продолжается в памяти.';
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    storageWarning = '';
  } catch (error) {
    storageWarning = 'Хранилище недоступно: изменения не сохраняются, работа продолжается в памяти.';
  }
}

// --- Ссылки на DOM ---
const form = document.querySelector('#task-form');
const titleInput = document.querySelector('#title');
const hoursInput = document.querySelector('#hours');
const titleError = document.querySelector('#title-error');
const hoursError = document.querySelector('#hours-error');
const totalHoursEl = document.querySelector('#total-hours');
const doneHoursEl = document.querySelector('#done-hours');
const progressEl = document.querySelector('#progress');
const listEl = document.querySelector('#task-list');
const emptyStateEl = document.querySelector('#empty-state');
const filterInputs = document.querySelectorAll('input[name="filter"]');
const storageWarningEl = document.querySelector('#storage-warning');

// --- Отрисовка ---
function renderMetrics() {
  totalHoursEl.textContent = `${totalHours(tasks)} ч`;
  doneHoursEl.textContent = `${doneHours(tasks)} ч`;
  progressEl.textContent = `${progress(tasks)}%`;
}

function renderList() {
  const visible = filterTasks(tasks, currentFilter);
  listEl.textContent = '';

  for (const task of visible) {
    const item = document.createElement('li');
    item.className = 'task';
    item.dataset.id = String(task.id);
    if (task.done) {
      item.classList.add('task--done');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task__toggle';
    checkbox.checked = task.done;
    checkbox.id = `task-${task.id}`;
    checkbox.setAttribute('aria-label', `Отметить «${task.title}» выполненной`);

    const label = document.createElement('label');
    label.className = 'task__title';
    label.htmlFor = checkbox.id;
    label.textContent = task.title;

    const hours = document.createElement('span');
    hours.className = 'task__hours';
    hours.textContent = `${task.hours} ч`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'task__remove';
    remove.textContent = 'Удалить';
    remove.setAttribute('aria-label', `Удалить задачу «${task.title}»`);

    item.append(checkbox, label, hours, remove);
    listEl.append(item);
  }

  emptyStateEl.hidden = visible.length > 0;
  if (tasks.length === 0) {
    emptyStateEl.textContent = 'Задач нет. Добавьте первую задачу.';
  } else {
    emptyStateEl.textContent = 'Нет задач для выбранного фильтра.';
  }
}

function renderFilter() {
  for (const input of filterInputs) {
    input.checked = input.value === currentFilter;
  }
}

function renderStorageWarning() {
  storageWarningEl.textContent = storageWarning;
  storageWarningEl.hidden = storageWarning === '';
}

function render() {
  renderMetrics();
  renderList();
  renderFilter();
  renderStorageWarning();
}

// --- Обработчики ---
function clearErrors() {
  titleError.textContent = '';
  hoursError.textContent = '';
}

function showErrors(errors) {
  titleError.textContent = errors.title ?? '';
  hoursError.textContent = errors.hours ?? '';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const { valid, errors, value } = validateTaskInput(titleInput.value, hoursInput.value);
  showErrors(errors);

  if (!valid) {
    // Значения формы остаются нетронутыми, задача не добавляется.
    return;
  }

  tasks = addTask(tasks, value);
  form.reset();
  clearErrors();
  saveTasks();
  render();
});

listEl.addEventListener('change', (event) => {
  const checkbox = event.target.closest('.task__toggle');
  if (!checkbox) {
    return;
  }
  const id = Number(checkbox.closest('.task').dataset.id);
  tasks = toggleTask(tasks, id);
  saveTasks();
  render();
});

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('.task__remove');
  if (!button) {
    return;
  }
  const id = Number(button.closest('.task').dataset.id);
  tasks = removeTask(tasks, id);
  saveTasks();
  render();
});

for (const input of filterInputs) {
  input.addEventListener('change', () => {
    if (input.checked) {
      currentFilter = input.value;
      renderList();
    }
  });
}

// --- Запуск ---
loadTasks();
render();
