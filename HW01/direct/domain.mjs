/**
 * Чистая доменная логика мини-трекера.
 * Здесь нет DOM, localStorage и других побочных эффектов.
 */

export const MIN_HOURS = 0.5;
export const MAX_HOURS = 24;
export const HOUR_STEP = 0.5;

export const FILTERS = Object.freeze(["all", "active", "done"]);

const INITIAL_TASKS = Object.freeze([
  Object.freeze({ id: "reading", title: "Чтение", hours: 2, done: true }),
  Object.freeze({ id: "practice", title: "Практика", hours: 4, done: false }),
  Object.freeze({ id: "review", title: "Повторение", hours: 2, done: false }),
]);

/**
 * Возвращает новые объекты, чтобы вызывающий код не мог изменить эталон.
 * @returns {Array<{id: string, title: string, hours: number, done: boolean}>}
 */
export function getInitialTasks() {
  return INITIAL_TASKS.map((task) => ({ ...task }));
}

function isHalfStep(hours) {
  const doubled = hours * 2;
  return Math.abs(doubled - Math.round(doubled)) < 1e-9;
}

function isEmpty(raw) {
  return raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");
}

/**
 * Проверяет поля формы. Пустая строка часов — ошибка, а не ноль.
 * @param {{title?: unknown, hours?: unknown}} input
 * @returns {{valid: boolean, errors: {title?: string, hours?: string}, value: {title: string, hours: number|null}}}
 */
export function validateTaskInput(input = {}) {
  const errors = {};

  const rawTitle = input?.title;
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (title === "") {
    errors.title = "Введите название задачи.";
  }

  const rawHours = input?.hours;
  let hours = Number.NaN;

  if (isEmpty(rawHours)) {
    errors.hours = "Укажите часы.";
  } else {
    const normalized =
      typeof rawHours === "string" ? rawHours.trim().replace(",", ".") : rawHours;
    const parsed =
      typeof normalized === "number" || typeof normalized === "string"
        ? Number(normalized)
        : Number.NaN;

    if (!Number.isFinite(parsed)) {
      errors.hours = "Часы должны быть числом.";
    } else if (parsed < MIN_HOURS || parsed > MAX_HOURS) {
      errors.hours = "Часы должны быть от 0.5 до 24.";
    } else if (!isHalfStep(parsed)) {
      errors.hours = "Шаг изменения часов — 0.5.";
    } else {
      hours = parsed;
    }
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    value: { title, hours: valid ? hours : null },
  };
}

/**
 * Создаёт задачу, только если входные данные корректны.
 * @param {{title?: unknown, hours?: unknown}} input
 * @param {string} id
 */
export function createTask(input, id) {
  const result = validateTaskInput(input);
  if (!result.valid) {
    return { ok: false, task: null, errors: result.errors };
  }
  return {
    ok: true,
    task: { id: String(id), title: result.value.title, hours: result.value.hours, done: false },
    errors: {},
  };
}

/**
 * Добавляет задачу. При ошибке возвращает исходный массив без изменений.
 * @param {Array} tasks
 * @param {{title?: unknown, hours?: unknown}} input
 * @param {string} id
 */
export function addTask(tasks, input, id) {
  const result = createTask(input, id);
  if (!result.ok) {
    return { ok: false, tasks, task: null, errors: result.errors };
  }
  return { ok: true, tasks: [...tasks, result.task], task: result.task, errors: {} };
}

export function toggleTask(tasks, id) {
  let changed = false;
  const next = tasks.map((task) => {
    if (task.id !== id) return { ...task };
    changed = true;
    return { ...task, done: !task.done };
  });
  return changed ? next : tasks;
}

export function removeTask(tasks, id) {
  const next = tasks.filter((task) => task.id !== id);
  return next.length === tasks.length ? tasks : next;
}

/**
 * Итоги всегда считаются по всем задачам, независимо от фильтра.
 * @param {Array<{hours?: unknown, done?: boolean}>} tasks
 */
export function calculateSummary(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  let totalHours = 0;
  let doneHours = 0;

  for (const task of list) {
    const hours = Number(task?.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    totalHours += hours;
    if (task.done === true) doneHours += hours;
  }

  // Суммы состоят из шагов 0.5, но округление защищает от накопленной погрешности.
  totalHours = Math.round(totalHours * 2) / 2;
  doneHours = Math.round(doneHours * 2) / 2;

  const progress =
    totalHours === 0 ? 0 : Math.round((100 * Math.min(doneHours, totalHours)) / totalHours);

  return {
    totalHours,
    doneHours,
    progress: Number.isFinite(progress) ? progress : 0,
  };
}

/**
 * Фильтр влияет только на возвращаемый список.
 * @param {Array} tasks
 * @param {"all"|"active"|"done"|string} filter
 */
export function filterTasks(tasks, filter = "all") {
  const list = Array.isArray(tasks) ? tasks : [];
  if (filter === "active") return list.filter((task) => !task.done);
  if (filter === "done") return list.filter((task) => task.done);
  return list.slice();
}
