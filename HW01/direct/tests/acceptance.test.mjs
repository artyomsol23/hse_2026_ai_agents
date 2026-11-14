import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_HOURS,
  MIN_HOURS,
  addTask,
  calculateSummary,
  filterTasks,
  getInitialTasks,
  removeTask,
  toggleTask,
  validateTaskInput,
} from "../domain.mjs";

const INITIAL_SUMMARY = { totalHours: 8, doneHours: 2, progress: 25 };

function taskByTitle(tasks, title) {
  return tasks.find((task) => task.title === title);
}

test("T1. Исходный пример: 3 задачи, 8 ч всего, 2 ч выполнено, прогресс 25%", () => {
  const tasks = getInitialTasks();

  assert.equal(tasks.length, 3);
  assert.deepEqual(
    tasks.map((task) => task.title),
    ["Чтение", "Практика", "Повторение"],
  );
  assert.deepEqual(
    tasks.map((task) => task.hours),
    [2, 4, 2],
  );
  assert.deepEqual(
    tasks.map((task) => task.done),
    [true, false, false],
  );
  assert.deepEqual(calculateSummary(tasks), INITIAL_SUMMARY);
});

test("T2. Отметить «Практику» выполненной: 6 из 8 ч, прогресс 75%, данные изменились", () => {
  const tasks = getInitialTasks();
  const practice = taskByTitle(tasks, "Практика");

  assert.equal(practice.done, false);

  const updated = toggleTask(tasks, practice.id);

  assert.equal(taskByTitle(updated, "Практика").done, true);
  assert.deepEqual(calculateSummary(updated), {
    totalHours: 8,
    doneHours: 6,
    progress: 75,
  });
  assert.equal(updated.length, 3);
});

test("T3. Исходные данные + фильтр «активные»: видны «Практика» и «Повторение», прогресс 25%", () => {
  const tasks = getInitialTasks();
  const visible = filterTasks(tasks, "active");

  assert.deepEqual(
    visible.map((task) => task.title),
    ["Практика", "Повторение"],
  );
  assert.equal(visible.length, 2);
  assert.deepEqual(calculateSummary(tasks), INITIAL_SUMMARY);
  assert.equal(tasks.length, 3, "фильтр не меняет исходный список");
});

test("T4. Невалидные название и часы не добавляются, возвращаются ошибки полей", () => {
  const invalidInputs = [
    { title: "", hours: 1, field: "title" },
    { title: "   ", hours: 1, field: "title" },
    { title: "Задача", hours: "", field: "hours" },
    { title: "Задача", hours: "   ", field: "hours" },
    { title: "Задача", hours: 0, field: "hours" },
    { title: "Задача", hours: "0", field: "hours" },
    { title: "Задача", hours: -1, field: "hours" },
    { title: "Задача", hours: 0.4, field: "hours" },
    { title: "Задача", hours: 24.5, field: "hours" },
    { title: "Задача", hours: 1.25, field: "hours" },
    { title: "Задача", hours: "abc", field: "hours" },
  ];

  for (const { title, hours, field } of invalidInputs) {
    const tasks = getInitialTasks();
    const result = addTask(tasks, { title, hours }, `invalid-${field}-${String(hours)}`);

    assert.equal(result.ok, false, `должно быть отклонено: ${JSON.stringify({ title, hours })}`);
    assert.equal(result.tasks.length, 3, "некорректная задача не добавляется");
    assert.equal(result.task, null);

    const validation = validateTaskInput({ title, hours });
    assert.equal(validation.valid, false);
    assert.equal(typeof validation.errors[field], "string");
    assert.notEqual(validation.errors[field].trim(), "");
  }
});

test("T4. Пустые часы — ошибка, а не ноль; 0 тоже отклоняется", () => {
  const empty = validateTaskInput({ title: "Задача", hours: "" });
  const zero = validateTaskInput({ title: "Задача", hours: 0 });

  assert.equal(empty.valid, false);
  assert.equal(zero.valid, false);
  assert.ok(empty.errors.hours);
  assert.ok(zero.errors.hours);
  assert.equal(empty.value.hours, null);
  assert.equal(zero.value.hours, null);
});

test("T4. Границы 0.5–24 и шаг 0.5: корректные значения принимаются", () => {
  for (const hours of [MIN_HOURS, 0.5, 1, 1.5, 23.5, 24, MAX_HOURS]) {
    const result = validateTaskInput({ title: "  Задача  ", hours });
    assert.equal(result.valid, true, `часы ${hours} должны быть корректны`);
    assert.equal(result.value.title, "Задача", "название обрезается по краям");
    assert.equal(result.value.hours, hours);
  }

  const below = [0, 0.25, 0.4, 24.5, 25];
  const notStep = [0.6, 1.1, 1.25, 23.9];

  for (const hours of below) {
    assert.equal(validateTaskInput({ title: "Задача", hours }).valid, false, `часы ${hours}`);
  }
  for (const hours of notStep) {
    assert.equal(validateTaskInput({ title: "Задача", hours }).valid, false, `часы ${hours}`);
  }
});

test("T4. Корректная задача добавляется с названием без пробелов и done=false", () => {
  const tasks = getInitialTasks();
  const result = addTask(tasks, { title: "  Конспект  ", hours: "1,5" }, "notes");

  assert.equal(result.ok, true);
  assert.equal(result.tasks.length, 4);
  assert.deepEqual(result.task, {
    id: "notes",
    title: "Конспект",
    hours: 1.5,
    done: false,
  });
  assert.equal(tasks.length, 3, "исходный массив не изменяется");
});

test("T5. После удаления всех задач: 0 ч, 0%, без NaN/Infinity, интерфейсные операции доступны", () => {
  let tasks = getInitialTasks();

  for (const task of getInitialTasks()) {
    tasks = removeTask(tasks, task.id);
  }

  assert.equal(tasks.length, 0);

  const summary = calculateSummary(tasks);
  assert.deepEqual(summary, { totalHours: 0, doneHours: 0, progress: 0 });
  assert.equal(Number.isFinite(summary.totalHours), true);
  assert.equal(Number.isFinite(summary.doneHours), true);
  assert.equal(Number.isFinite(summary.progress), true);

  assert.deepEqual(filterTasks(tasks, "all"), []);
  assert.deepEqual(filterTasks(tasks, "active"), []);
  assert.deepEqual(filterTasks(tasks, "done"), []);

  const afterAdding = addTask(tasks, { title: "Новая задача", hours: 1.5 }, "after-empty");
  assert.equal(afterAdding.ok, true);
  assert.deepEqual(calculateSummary(afterAdding.tasks), {
    totalHours: 1.5,
    doneHours: 0,
    progress: 0,
  });
});

test("R3. Пустой список даёт 0% без NaN/Infinity", () => {
  const summary = calculateSummary([]);
  assert.deepEqual(summary, { totalHours: 0, doneHours: 0, progress: 0 });
  assert.equal(Number.isFinite(summary.progress), true);
});

test("R3. Прогресс округляется по правилу 100 * done / all", () => {
  const tasks = [
    { id: "a", title: "A", hours: 1, done: true },
    { id: "b", title: "B", hours: 1, done: false },
    { id: "c", title: "C", hours: 1, done: false },
  ];
  assert.equal(calculateSummary(tasks).progress, 33);

  const twoOfThree = tasks.map((task) => (task.id === "b" ? { ...task, done: true } : task));
  assert.equal(calculateSummary(twoOfThree).progress, 67);
});

test("R4. Фильтр не влияет на итоговые часы и прогресс", () => {
  for (const tasks of [getInitialTasks(), toggleTask(getInitialTasks(), "practice")]) {
    const all = calculateSummary(tasks);
    const before = tasks.map((task) => ({ ...task }));

    for (const filter of ["all", "active", "done"]) {
      const visible = filterTasks(tasks, filter);
      assert.deepEqual(calculateSummary(tasks), all, `итоги не зависят от фильтра ${filter}`);
      assert.deepEqual(tasks, before, "фильтр не мутирует список задач");

      if (filter === "active") assert.equal(visible.every((task) => !task.done), true);
      if (filter === "done") assert.equal(visible.every((task) => task.done), true);
      if (filter === "all") assert.equal(visible.length, tasks.length);
    }
  }

  const initial = getInitialTasks();
  assert.deepEqual(
    filterTasks(initial, "done").map((task) => task.title),
    ["Чтение"],
  );
  assert.equal(filterTasks(initial, "all").length, 3);
});

test("R1. Переключение и удаление реально меняют данные", () => {
  const tasks = getInitialTasks();
  const practice = taskByTitle(tasks, "Практика");

  const toggled = toggleTask(tasks, practice.id);
  assert.equal(taskByTitle(toggled, "Практика").done, true);
  assert.equal(taskByTitle(tasks, "Практика").done, false);

  const removed = removeTask(tasks, practice.id);
  assert.equal(removed.length, 2);
  assert.equal(taskByTitle(removed, "Практика"), undefined);
  assert.equal(taskByTitle(tasks, "Практика").title, "Практика");

  const restored = removeTask(getInitialTasks(), "reading");
  assert.equal(restored.length, 2);
  assert.deepEqual(calculateSummary(restored), {
    totalHours: 6,
    doneHours: 0,
    progress: 0,
  });
});
