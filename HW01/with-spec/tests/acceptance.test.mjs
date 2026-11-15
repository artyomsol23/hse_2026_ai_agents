// Приёмочные проверки чистой логики через node:test.
// Запуск: node --test

import test from 'node:test';
import assert from 'node:assert/strict';

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
} from '../domain.mjs';

test('T1: исходный набор — 3 задачи, 8 ч всего, 2 ч выполнено, 25%', () => {
  const tasks = createInitialTasks();

  assert.equal(tasks.length, 3);
  assert.equal(totalHours(tasks), 8);
  assert.equal(doneHours(tasks), 2);
  assert.equal(progress(tasks), 25);
});

test('T2: отметка «Практики» даёт 6 из 8 ч и прогресс 75%', () => {
  const tasks = createInitialTasks();
  const practice = tasks.find((task) => task.title === 'Практика');

  const updated = toggleTask(tasks, practice.id);

  assert.equal(doneHours(updated), 6);
  assert.equal(totalHours(updated), 8);
  assert.equal(progress(updated), 75);
});

test('T3: фильтр «активные» показывает «Практика» и «Повторение», прогресс остаётся 25%', () => {
  const tasks = createInitialTasks();

  const visible = filterTasks(tasks, 'active').map((task) => task.title);

  assert.deepEqual(visible, ['Практика', 'Повторение']);
  assert.equal(progress(tasks), 25);
});

test('T3: метрики не зависят от фильтра', () => {
  const tasks = createInitialTasks();
  const filters = ['all', 'active', 'done'];

  for (const filter of filters) {
    filterTasks(tasks, filter);
    assert.equal(totalHours(tasks), 8);
    assert.equal(doneHours(tasks), 2);
    assert.equal(progress(tasks), 25);
  }
});

test('T5: при отсутствии задач прогресс 0 без NaN/Infinity', () => {
  const tasks = [];

  assert.equal(totalHours(tasks), 0);
  assert.equal(doneHours(tasks), 0);
  assert.equal(progress(tasks), 0);
  assert.ok(Number.isFinite(progress(tasks)));
});

test('T5: удаление всех задач оставляет корректные метрики', () => {
  let tasks = createInitialTasks();
  for (const task of createInitialTasks()) {
    tasks = removeTask(tasks, task.id);
  }

  assert.equal(tasks.length, 0);
  assert.equal(progress(tasks), 0);
  assert.ok(Number.isFinite(progress(tasks)));
});

test('добавление реально меняет данные', () => {
  const tasks = createInitialTasks();
  const before = tasks.length;

  const updated = addTask(tasks, { title: 'Конспект', hours: 1.5 });

  assert.equal(updated.length, before + 1);
  assert.equal(updated.at(-1).title, 'Конспект');
  assert.equal(updated.at(-1).hours, 1.5);
  assert.equal(updated.at(-1).done, false);
});

test('удаление реально меняет данные', () => {
  const tasks = createInitialTasks();

  const updated = removeTask(tasks, tasks[0].id);

  assert.equal(updated.length, tasks.length - 1);
  assert.ok(!updated.some((task) => task.id === tasks[0].id));
});

test('переключение done реально меняет данные', () => {
  const tasks = createInitialTasks();
  const first = tasks[0];

  const updated = toggleTask(tasks, first.id);

  assert.equal(updated.find((task) => task.id === first.id).done, !first.done);
});

test('T4: пустое и пробельное название отклонены', () => {
  assert.equal(validateTaskInput('', '2').valid, false);
  assert.ok(validateTaskInput('', '2').errors.title);
  assert.equal(validateTaskInput('   ', '2').valid, false);
  assert.ok(validateTaskInput('   ', '2').errors.title);
});

test('T4: пустые, нулевые и отрицательные часы отклонены', () => {
  for (const hours of ['', '   ', '0', '-1']) {
    const result = validateTaskInput('Задача', hours);
    assert.equal(result.valid, false, `часы ${JSON.stringify(hours)} должны быть отклонены`);
    assert.ok(result.errors.hours);
  }
});

test('T4: пустое значение часов не считается нулём', () => {
  const result = validateTaskInput('Задача', '');

  assert.equal(result.valid, false);
  assert.notEqual(result.value.hours, 0);
});

test('T4: границы 0.5 и 24 принимаются', () => {
  assert.equal(validateTaskInput('Задача', '0.5').valid, true);
  assert.equal(validateTaskInput('Задача', '24').valid, true);
  assert.equal(validateTaskInput('Задача', 0.5).valid, true);
  assert.equal(validateTaskInput('Задача', 24).valid, true);
});

test('T4: значения ниже минимума и выше максимума отклонены', () => {
  assert.equal(validateTaskInput('Задача', '0.25').valid, false);
  assert.ok(validateTaskInput('Задача', '0.25').errors.hours);
  assert.equal(validateTaskInput('Задача', '24.5').valid, false);
  assert.ok(validateTaskInput('Задача', '24.5').errors.hours);
});

test('T4: значение, не кратное шагу 0.5, отклонено', () => {
  const result = validateTaskInput('Задача', '1.3');

  assert.equal(result.valid, false);
  assert.ok(result.errors.hours);
});

test('T4: при ошибке задача не добавляется и данные не меняются', () => {
  const tasks = createInitialTasks();
  const result = validateTaskInput('   ', '1.3');

  const after = result.valid ? addTask(tasks, result.value) : tasks;

  assert.equal(result.valid, false);
  assert.equal(after, tasks);
  assert.equal(after.length, 3);
});

test('T4: при ошибке введённые значения формы сохранены в результате', () => {
  const result = validateTaskInput('  Задача  ', '1.3');

  assert.equal(result.valid, false);
  assert.equal(result.value.title, 'Задача');
  assert.equal(result.value.hours, null);
});
