import {
  FILTERS,
  addTask,
  calculateSummary,
  filterTasks,
  getInitialTasks,
  removeTask,
  toggleTask,
} from "./domain.mjs";

const state = {
  tasks: getInitialTasks(),
  filter: "all",
  sequence: 0,
};

const elements = {
  form: document.getElementById("task-form"),
  title: document.getElementById("title"),
  hours: document.getElementById("hours"),
  titleError: document.getElementById("title-error"),
  hoursError: document.getElementById("hours-error"),
  summaryTotal: document.getElementById("total-hours"),
  summaryDone: document.getElementById("done-hours"),
  summaryProgress: document.getElementById("progress-value"),
  progress: document.getElementById("progress"),
  progressBar: document.getElementById("progress-bar"),
  list: document.getElementById("task-list"),
  listEmpty: document.getElementById("list-empty"),
  reset: document.getElementById("reset-data"),
  filters: Array.from(document.querySelectorAll("[data-filter]")),
  announcer: document.getElementById("announcer"),
};

function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  state.sequence += 1;
  return `task-${Date.now()}-${state.sequence}`;
}

function formatHours(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace(".", ",")} ч`;
}

function announce(message) {
  elements.announcer.textContent = "";
  elements.announcer.textContent = message;
}

function setFieldError(field, message) {
  const input = field === "title" ? elements.title : elements.hours;
  const error = field === "title" ? elements.titleError : elements.hoursError;
  error.textContent = message ?? "";
  if (message) {
    input.setAttribute("aria-invalid", "true");
  } else {
    input.removeAttribute("aria-invalid");
  }
}

function showErrors(errors) {
  setFieldError("title", errors.title);
  setFieldError("hours", errors.hours);
  const firstInvalid = errors.title ? elements.title : errors.hours ? elements.hours : null;
  firstInvalid?.focus();
}

function clearErrors() {
  setFieldError("title");
  setFieldError("hours");
}

function createTaskItem(task) {
  const item = document.createElement("li");
  item.className = task.done ? "task task--done" : "task";

  const safeId = `task-${String(task.id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task__checkbox";
  checkbox.id = safeId;
  checkbox.dataset.id = task.id;
  checkbox.checked = task.done;
  checkbox.setAttribute(
    "aria-label",
    task.done ? `Отметить «${task.title}» как активную` : `Отметить «${task.title}» выполненной`,
  );

  const title = document.createElement("label");
  title.className = "task__title";
  title.htmlFor = safeId;
  title.textContent = task.title;

  const hours = document.createElement("span");
  hours.className = "task__hours";
  hours.textContent = formatHours(task.hours);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "task__delete";
  remove.dataset.action = "delete";
  remove.dataset.id = task.id;
  remove.textContent = "Удалить";
  remove.setAttribute("aria-label", `Удалить задачу «${task.title}»`);

  item.append(checkbox, title, hours, remove);
  return item;
}

function render() {
  const summary = calculateSummary(state.tasks);
  elements.summaryTotal.textContent = formatHours(summary.totalHours);
  elements.summaryDone.textContent = formatHours(summary.doneHours);
  elements.summaryProgress.textContent = `${summary.progress}%`;
  elements.progress.setAttribute("aria-valuenow", String(summary.progress));
  elements.progressBar.style.width = `${summary.progress}%`;

  for (const button of elements.filters) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter));
  }

  const visible = filterTasks(state.tasks, state.filter);
  elements.list.replaceChildren(...visible.map(createTaskItem));

  let emptyMessage = "";
  if (state.tasks.length === 0) {
    emptyMessage = "Задач пока нет. Добавьте первую задачу.";
  } else if (visible.length === 0) {
    emptyMessage = "В этом фильтре задач нет.";
  }
  elements.listEmpty.textContent = emptyMessage;
  elements.listEmpty.hidden = emptyMessage === "";
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = addTask(
    state.tasks,
    { title: elements.title.value, hours: elements.hours.value },
    createId(),
  );

  if (!result.ok) {
    showErrors(result.errors);
    announce("Не удалось добавить задачу. Проверьте поля формы.");
    return;
  }

  state.tasks = result.tasks;
  clearErrors();
  elements.form.reset();
  render();
  announce(`Задача «${result.task.title}» добавлена.`);
  elements.title.focus();
});

elements.title.addEventListener("input", () => setFieldError("title"));
elements.hours.addEventListener("input", () => setFieldError("hours"));

elements.list.addEventListener("change", (event) => {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || !checkbox.matches(".task__checkbox")) return;

  const task = state.tasks.find((item) => item.id === checkbox.dataset.id);
  if (!task) return;

  state.tasks = toggleTask(state.tasks, task.id);
  render();
  announce(`«${task.title}»: ${task.done ? "снова активна" : "выполнена"}.`);
});

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest?.('button[data-action="delete"]');
  if (!button) return;

  const task = state.tasks.find((item) => item.id === button.dataset.id);
  if (!task) return;

  state.tasks = removeTask(state.tasks, task.id);
  render();
  announce(`Задача «${task.title}» удалена.`);
});

for (const button of elements.filters) {
  button.addEventListener("click", () => {
    if (!FILTERS.includes(button.dataset.filter)) return;
    state.filter = button.dataset.filter;
    render();
    announce(`Фильтр: ${button.textContent.trim()}.`);
  });
}

elements.reset.addEventListener("click", () => {
  state.tasks = getInitialTasks();
  state.filter = "all";
  render();
  announce("Исходные данные восстановлены.");
});

render();
