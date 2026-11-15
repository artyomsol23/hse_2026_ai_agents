// Чистая логика трекера: модель задачи, валидация, операции и расчёты.
// Без обращения к DOM и браузерным API, чтобы функции можно было тестировать в Node.

export const HOURS_MIN = 0.5;
export const HOURS_MAX = 24;
export const HOURS_STEP = 0.5;

/** Стартовый набор задач из brief.md: 8 ч всего, 2 ч выполнено, прогресс 25%. */
export function createInitialTasks() {
  return [
    { id: 1, title: 'Чтение', hours: 2, done: true },
    { id: 2, title: 'Практика', hours: 4, done: false },
    { id: 3, title: 'Повторение', hours: 2, done: false },
  ];
}

/** Следующий свободный id на основе максимального существующего. */
export function nextId(tasks) {
  return tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}

/** Кратно ли значение шагу 0.5 (с поправкой на погрешность чисел с плавающей точкой). */
export function isMultipleOfStep(value) {
  const steps = value / HOURS_STEP;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

/**
 * Проверяет ввод формы. Не бросает исключение, а возвращает ошибки по полям,
 * чтобы интерфейс показал сообщение рядом с полем и сохранил введённые значения.
 */
export function validateTaskInput(title, hoursRaw) {
  const errors = {};

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (trimmedTitle === '') {
    errors.title = 'Название не может быть пустым';
  }

  const raw = typeof hoursRaw === 'string' ? hoursRaw.trim() : hoursRaw;
  let hours = null;

  if (raw === '' || raw === null || raw === undefined) {
    // Пустое значение не считается нулём.
    errors.hours = 'Укажите часы';
  } else {
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      errors.hours = 'Часы должны быть числом';
    } else if (value < HOURS_MIN || value > HOURS_MAX) {
      errors.hours = `Часы должны быть от ${HOURS_MIN} до ${HOURS_MAX}`;
    } else if (!isMultipleOfStep(value)) {
      errors.hours = 'Часы должны быть кратны 0.5';
    } else {
      hours = value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { title: trimmedTitle, hours },
  };
}

/** Добавляет задачу, возвращая новый массив (входной не мутируется). */
export function addTask(tasks, { title, hours }) {
  const task = {
    id: nextId(tasks),
    title: String(title).trim(),
    hours: Number(hours),
    done: false,
  };
  return [...tasks, task];
}

/** Удаляет задачу по id. */
export function removeTask(tasks, id) {
  return tasks.filter((task) => task.id !== id);
}

/** Переключает признак done у задачи по id. */
export function toggleTask(tasks, id) {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}

/** Сумма часов всех задач. */
export function totalHours(tasks) {
  return tasks.reduce((sum, task) => sum + task.hours, 0);
}

/** Сумма часов выполненных задач. */
export function doneHours(tasks) {
  return tasks.reduce((sum, task) => sum + (task.done ? task.hours : 0), 0);
}

/**
 * Прогресс = округление(100 × часы выполненных / все часы).
 * При отсутствии задач возвращает 0 без NaN/Infinity.
 */
export function progress(tasks) {
  const total = totalHours(tasks);
  if (total === 0) {
    return 0;
  }
  return Math.round((100 * doneHours(tasks)) / total);
}

/** Возвращает задачи для отображения: all | active | done. */
export function filterTasks(tasks, filter) {
  if (filter === 'active') {
    return tasks.filter((task) => !task.done);
  }
  if (filter === 'done') {
    return tasks.filter((task) => task.done);
  }
  return [...tasks];
}
