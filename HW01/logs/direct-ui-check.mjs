import { writeFile } from "node:fs/promises";

const APP_URL = `http://127.0.0.1:8123/index.html?run=${Date.now()}`;
const OUT_DIR = "/private/var/folders/q9/mf7q00mx6bl7xlrrmrfvf48m0000gn/T/opencode/hw01-ui";
const CDP = "http://127.0.0.1:9333";

const failures = [];
const checks = [];
function check(name, condition, details) {
  if (condition) {
    checks.push({ ok: true, name });
  } else {
    failures.push({ ok: false, name, details });
    checks.push({ ok: false, name, details });
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${CDP}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {
      // Chrome ещё запускается.
    }
    await sleep(100);
  }
  throw new Error("Не удалось подключиться к Chrome DevTools Protocol");
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const pageErrors = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    pageErrors.push(details?.exception?.description ?? details?.text ?? "exception");
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    pageErrors.push(message.params.entry.text);
  }
});

function send(method, params = {}) {
  const id = ++sequence;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(expression, label, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(50);
  }
  throw new Error(`Таймаут ожидания: ${label}`);
}

async function screenshot(name) {
  const metrics = await send("Page.getLayoutMetrics");
  const width = Math.ceil(metrics.cssContentSize.width);
  const height = Math.ceil(metrics.cssContentSize.height);
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  const path = `${OUT_DIR}/${name}`;
  await writeFile(path, Buffer.from(shot.data, "base64"));
  return path;
}

const snapshotExpression = `(() => {
  const text = (selector) => document.querySelector(selector)?.textContent.trim() ?? null;
  const tasks = [...document.querySelectorAll("#task-list .task")].map((item) => ({
    title: item.querySelector(".task__title").textContent,
    hours: item.querySelector(".task__hours").textContent,
    done: item.querySelector(".task__checkbox").checked,
    id: item.querySelector(".task__checkbox").dataset.id,
  }));
  return {
    total: text("#total-hours"),
    doneHours: text("#done-hours"),
    progress: text("#progress-value"),
    ariaNow: document.querySelector("#progress")?.getAttribute("aria-valuenow"),
    progressWidth: document.querySelector("#progress-bar")?.style.width,
    tasks,
    taskCount: document.querySelectorAll("#task-list .task").length,
    emptyText: text("#list-empty"),
    emptyHidden: document.querySelector("#list-empty")?.hidden,
    filterStates: Object.fromEntries([...document.querySelectorAll("[data-filter]")].map((b) => [b.dataset.filter, b.getAttribute("aria-pressed")])),
    bodyText: document.body.innerText,
  };
})()`;

await send("Runtime.enable");
await send("Page.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
  screenWidth: 390,
  screenHeight: 844,
});

await send("Page.navigate", { url: APP_URL });
await waitFor(
  `document.readyState === "complete" && document.querySelectorAll("#task-list .task").length === 3`,
  "загрузка приложения",
);
pageErrors.length = 0;

const overflowExpression = `(() => {
  const viewportWidth = document.documentElement.clientWidth;
  const overflowing = [...document.querySelectorAll("body *")]
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.position !== "absolute" && rect.width > 0 && (rect.right > viewportWidth + 0.5 || rect.left < -0.5);
    })
    .map((element) => ({
      tag: element.tagName,
      className: element.className,
      left: Math.round(element.getBoundingClientRect().left),
      right: Math.round(element.getBoundingClientRect().right),
    }));
  return { viewportWidth, overflowing };
})()`;

let layout = await evaluate(overflowExpression);
check(
  "390 px: ни один видимый элемент не выходит за viewport",
  layout.overflowing.length === 0,
  layout,
);

let snapshot = await evaluate(snapshotExpression);
check("Старт: 3 задачи", snapshot.taskCount === 3, snapshot);
check("Старт: всего 8 ч", snapshot.total === "8 ч", snapshot.total);
check("Старт: выполнено 2 ч", snapshot.doneHours === "2 ч", snapshot.doneHours);
check("Старт: прогресс 25%", snapshot.progress === "25%" && snapshot.ariaNow === "25", snapshot);
check(
  "Старт: исходные названия и часы",
  JSON.stringify(snapshot.tasks.map((t) => [t.title, t.hours, t.done])) ===
    JSON.stringify([
      ["Чтение", "2 ч", true],
      ["Практика", "4 ч", false],
      ["Повторение", "2 ч", false],
    ]),
  snapshot.tasks,
);
check(
  "Старт: активен фильтр «Все»",
  snapshot.filterStates.all === "true" &&
    snapshot.filterStates.active === "false" &&
    snapshot.filterStates.done === "false",
  snapshot.filterStates,
);
check("Старт: пустое состояние скрыто", snapshot.emptyHidden === true, snapshot.emptyText);

const labels = await evaluate(`(() => ({
  titleLabel: document.querySelector('label[for="title"]')?.textContent.trim(),
  hoursLabel: document.querySelector('label[for="hours"]')?.textContent.trim(),
  controls: [...document.querySelectorAll("#task-list input, #task-list button")].map((el) => ({
    tag: el.tagName,
    name: el.getAttribute("aria-label") || el.textContent.trim(),
  })),
  buttons: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()),
  progressRole: document.querySelector("#progress")?.getAttribute("role"),
  progressMin: document.querySelector("#progress")?.getAttribute("aria-valuemin"),
  progressMax: document.querySelector("#progress")?.getAttribute("aria-valuemax"),
}))()`);
check("Поля подписаны", labels.titleLabel === "Название" && labels.hoursLabel === "Часы", labels);
check(
  "Кнопки и чекбоксы подписаны",
  labels.controls.every((control) => control.name.length > 0) &&
    labels.buttons.every((button) => button.length > 0),
  labels,
);
check(
  "Прогресс размечен как progressbar 0–100",
  labels.progressRole === "progressbar" && labels.progressMin === "0" && labels.progressMax === "100",
  labels,
);

let widths = await evaluate(`({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
})`);
check(
  "390 px: нет горизонтального скролла на старте",
  widths.innerWidth === 390 && widths.scrollWidth <= widths.clientWidth,
  widths,
);
const initialShot = await screenshot("initial-390.png");

// T2: отметить «Практику» выполненной.
await evaluate(`document.querySelector('.task__checkbox[data-id="practice"]').click()`);
await waitFor(`document.querySelector("#progress-value").textContent.trim() === "75%"`, "прогресс 75%");
snapshot = await evaluate(snapshotExpression);
check("T2: данные — 6 из 8 ч, 75%", snapshot.total === "8 ч" && snapshot.doneHours === "6 ч" && snapshot.progress === "75%", snapshot);
check(
  "T2: «Практика» отмечена в интерфейсе",
  snapshot.tasks.find((task) => task.id === "practice")?.done === true,
  snapshot.tasks,
);

// T3: вернуть исходные данные и включить «активные».
await evaluate(`document.querySelector("#reset-data").click()`);
await waitFor(`document.querySelector("#progress-value").textContent.trim() === "25%"`, "сброс к 25%");
await evaluate(`document.querySelector('[data-filter="active"]').click()`);
await waitFor(`document.querySelectorAll("#task-list .task").length === 2`, "фильтр активных");
snapshot = await evaluate(snapshotExpression);
check(
  "T3: видны «Практика» и «Повторение»",
  JSON.stringify(snapshot.tasks.map((task) => task.title)) === JSON.stringify(["Практика", "Повторение"]),
  snapshot.tasks,
);
check(
  "T3: общий прогресс остаётся 25%",
  snapshot.total === "8 ч" && snapshot.doneHours === "2 ч" && snapshot.progress === "25%",
  snapshot,
);
check(
  "T3: фильтр «активные» нажат",
  snapshot.filterStates.active === "true" && snapshot.filterStates.all === "false",
  snapshot.filterStates,
);

// T4: ошибки формы, значения сохраняются.
await evaluate(`document.querySelector('[data-filter="all"]').click()`);
await evaluate(`(() => {
  const title = document.querySelector("#title");
  const hours = document.querySelector("#hours");
  title.value = "   ";
  hours.value = "";
  title.dispatchEvent(new Event("input", { bubbles: true }));
  hours.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector("#task-form").requestSubmit();
})()`);
let formState = await evaluate(`(() => ({
  titleValue: document.querySelector("#title").value,
  hoursValue: document.querySelector("#hours").value,
  titleError: document.querySelector("#title-error").textContent.trim(),
  hoursError: document.querySelector("#hours-error").textContent.trim(),
  titleInvalid: document.querySelector("#title").getAttribute("aria-invalid"),
  hoursInvalid: document.querySelector("#hours").getAttribute("aria-invalid"),
  titleErrorVisible: document.querySelector("#title-error").getBoundingClientRect().height > 0,
  hoursErrorVisible: document.querySelector("#hours-error").getBoundingClientRect().height > 0,
  taskCount: document.querySelectorAll("#task-list .task").length,
}))()`);
check(
  "T4: пустое название и пустые часы дают видимые ошибки",
  formState.titleError.length > 0 &&
    formState.hoursError.length > 0 &&
    formState.titleErrorVisible &&
    formState.hoursErrorVisible,
  formState,
);
check(
  "T4: значения формы сохранены, задача не добавлена",
  formState.titleValue === "   " && formState.hoursValue === "" && formState.taskCount === 3,
  formState,
);
const errorShot = await screenshot("validation-errors-390.png");

async function submit(title, hours) {
  await evaluate(`(() => {
    const titleInput = document.querySelector("#title");
    const hoursInput = document.querySelector("#hours");
    titleInput.value = ${JSON.stringify(title)};
    hoursInput.value = ${JSON.stringify(hours)};
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    hoursInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#task-form").requestSubmit();
  })()`);
  return evaluate(`(() => ({
    titleValue: document.querySelector("#title").value,
    hoursValue: document.querySelector("#hours").value,
    titleError: document.querySelector("#title-error").textContent.trim(),
    hoursError: document.querySelector("#hours-error").textContent.trim(),
    taskCount: document.querySelectorAll("#task-list .task").length,
    taskTitles: [...document.querySelectorAll("#task-list .task__title")].map((el) => el.textContent),
  }))()`);
}

formState = await submit("Задача", "-1");
check(
  "T4: отрицательные часы отклонены, значения сохранены",
  formState.hoursError.length > 0 &&
    formState.taskCount === 3 &&
    formState.titleValue === "Задача" &&
    formState.hoursValue === "-1",
  formState,
);

formState = await submit("Задача", "1.25");
check(
  "T4: шаг 0,5 проверяется, значения сохранены",
  formState.hoursError.length > 0 &&
    formState.taskCount === 3 &&
    formState.hoursValue === "1.25",
  formState,
);

formState = await submit("Задача", "24.5");
check(
  "T4: верхняя граница 24 проверяется",
  formState.hoursError.length > 0 && formState.taskCount === 3,
  formState,
);

formState = await submit("  Граница  ", "0.5");
check(
  "T4: 0,5 принимается, название обрезается",
  formState.taskCount === 4 &&
    formState.taskTitles.includes("Граница") &&
    formState.titleValue === "" &&
    formState.hoursValue === "",
  formState,
);

// Худший случай для мобильной ширины: длинное неразрывное название.
const longTitle = "ДлинноеНазваниеЗадачиБезПробелов".repeat(3);
formState = await submit(`  ${longTitle}  `, "24");
check(
  "R6: задача с длинным названием добавлена",
  formState.taskCount === 5 && formState.taskTitles.includes(longTitle),
  formState,
);
widths = await evaluate(`({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
})`);
check("390 px: длинное название не вызывает горизонтальный скролл", widths.scrollWidth <= widths.clientWidth, widths);
layout = await evaluate(overflowExpression);
check(
  "390 px: длинное название не выводит элементы за viewport",
  layout.overflowing.length === 0,
  layout,
);

// Удаляем две добавленные задачи, возвращая исходные три.
await evaluate(`(() => {
  const item = [...document.querySelectorAll("#task-list .task")].find((li) => li.querySelector(".task__title").textContent === ${JSON.stringify(longTitle)});
  item?.querySelector('button[data-action="delete"]').click();
})()`);
await waitFor(`document.querySelectorAll("#task-list .task").length === 4`, "удаление длинной задачи");
await evaluate(`(() => {
  const item = [...document.querySelectorAll("#task-list .task")].find((li) => li.querySelector(".task__title").textContent === "Граница");
  item?.querySelector('button[data-action="delete"]').click();
})()`);
await waitFor(`document.querySelectorAll("#task-list .task").length === 3`, "удаление задачи «Граница»");

// T5: удалить все задачи.
await evaluate(`(() => {
  let guard = 0;
  while (document.querySelector('#task-list button[data-action="delete"]') && guard < 20) {
    document.querySelector('#task-list button[data-action="delete"]').click();
    guard += 1;
  }
})()`);
await waitFor(`document.querySelectorAll("#task-list .task").length === 0`, "удаление всех задач");
snapshot = await evaluate(snapshotExpression);
check(
  "T5: 0 ч, 0%, прогресс без NaN/Infinity",
  snapshot.total === "0 ч" &&
    snapshot.doneHours === "0 ч" &&
    snapshot.progress === "0%" &&
    snapshot.ariaNow === "0" &&
    !/NaN|Infinity/.test(snapshot.bodyText),
  snapshot,
);
check(
  "T5: показано пустое состояние",
  snapshot.emptyHidden === false && snapshot.emptyText.length > 0,
  snapshot,
);
const emptyShot = await screenshot("empty-390.png");

formState = await submit("После пустого", "1");
snapshot = await evaluate(snapshotExpression);
check(
  "T5: интерфейс продолжает работать после удаления всех задач",
  formState.taskCount === 1 && snapshot.total === "1 ч" && snapshot.progress === "0%",
  { formState, snapshot },
);
await evaluate(`document.querySelector("#reset-data").click()`);
await waitFor(`document.querySelectorAll("#task-list .task").length === 3`, "финальный сброс");

check("Нет JS-исключений и ошибок в консоли", pageErrors.length === 0, pageErrors);

const report = {
  appUrl: APP_URL,
  viewport: { width: 390, height: 844 },
  checks,
  failures,
  pageErrors,
  screenshots: {
    initial: initialShot,
    validationErrors: errorShot,
    empty: emptyShot,
  },
};
console.log(JSON.stringify(report, null, 2));
ws.close();
if (failures.length > 0) process.exitCode = 1;
