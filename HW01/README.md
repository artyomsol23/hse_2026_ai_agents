# Homework #1 — Direct vs OpenSpec

## Вариант задания

B — Medium.

Мини-трекер учебных задач на неделю.
Сравнение прямой разработки и разработки
с предварительной спецификацией OpenSpec.

## Окружение

- macOS ARM64
- Node.js 24.22.3
- npm 11.19.1
- OpenCode 2.2.7
- OpenSpec 1.14.1
- Модель: Big Pickle

## Структура проекта

| Путь | Содержимое |
|---|---|
| direct/ | Реализация без OpenSpec |
| with-spec/ | Реализация с OpenSpec |
| logs/ | Реальные журналы проверок |
| screenshots/ | Скриншоты интерфейсов |
| REPORT.md | Сравнительный отчёт |
| PROMPTS.md | Использованные промпты |

## Запуск direct

Из корня HW01:

```bash
cd direct
npx --yes http-server@14.1.1 . -p 8080 -c-1
```

Открыть http://localhost:8080

## Запуск with-spec

Из корня HW01:

```bash
cd with-spec
npx --yes http-server@14.1.1 . -p 8081 -c-1
```

Открыть http://localhost:8081

## Автоматические тесты

Из корня HW01:

```bash
node --test direct/tests/acceptance.test.mjs
node --test with-spec/tests/acceptance.test.mjs
```

Результаты:

- direct: 12/12 PASS.
- with-spec: 17/17 PASS.

## Валидация OpenSpec

```bash
cd with-spec
openspec validate build-tracker --strict --no-interactive
```

Спецификация находится в
with-spec/openspec/changes/build-tracker/.

## Исходные данные

- Чтение — 2 ч, выполнено.
- Практика — 4 ч, не выполнено.
- Повторение — 2 ч, не выполнено.

Всего 8 ч, выполнено 2 ч, прогресс 25%.

## Скриншоты

### Direct

![Direct](screenshots/direct.png)

### With-spec

![With-spec](screenshots/with-spec.png)

## Отчёт и подтверждения

- [Сравнительный отчёт](REPORT.md)
- [Промпты](PROMPTS.md)
- [Логи direct](logs/direct-tests.log)
- [Логи with-spec](logs/with-spec-tests.log)
