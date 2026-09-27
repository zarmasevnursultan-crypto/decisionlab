# DecisionLab API v1

Интерактивная консоль: `/api-test`. Машиночитаемая спецификация: `/openapi.json` (OpenAPI 3.1, импортируется в Swagger/Postman). Контракт операций: `lib/api-contract.json`; обновление спецификации: `npm run docs:api`.

## Ответы и аутентификация

```json
{"success":true,"data":{},"message":"Готово"}
```

```json
{"success":false,"error":{"code":"SESSION_EXPIRED","message":"Время расследования истекло. Начните его заново или выберите новое дело."}}
```

`POST session` выдаёт HttpOnly-cookie `decisionlab_session` и `decisionlab_player`. Клиент должен сохранять и отправлять **обе** cookie. Для curl используйте `-c cookies.txt -b cookies.txt`. Токены никогда не возвращаются в JSON. Cookie живут 90 дней для восстановления результатов; игровое время проверяется сервером и составляет 30 минут.

POST принимает JSON-объект. Неверный JSON — 400, неверный UUID/параметр — 422, размер тела более 16000 символов — 413. При наличии Origin он должен совпадать с origin запроса. Все ответы API имеют `Cache-Control: no-store`.

## Операции и примеры

В примерах `CASE`, `EVIDENCE`, `SUSPECT` заменяются реальными UUID из ответа GET case или generate. Для запросов без body используется GET; для остальных — POST с `Content-Type: application/json`.

| Method / URL | Пример body / query | Ответ `data` | Специфические ошибки |
| --- | --- | --- | --- |
| `GET /api/health` | — | `{status,services:{application,database,ai},checkedAt}` | 500 при внутренней ошибке |
| `GET /api/case` | `?caseId=CASE` необязательно | `CaseBundle` | 401 без текущей сессии; 404 неизвестное дело; 503 база недоступна |
| `POST /api/case/session` | `{"caseId":"CASE"}` | `SessionSnapshot` | 404 неизвестное дело; 503 база недоступна/нет миграции |
| `GET /api/case/session` | — | `SessionSnapshot` | 401 отсутствует или чужая сессия; 503 база недоступна |
| `POST /api/case/evidence` | `{"evidenceId":"EVIDENCE"}` | `SessionSnapshot` | 404 чужой материал; 409 прохождение истекло/завершено |
| `POST /api/case/hint` | `{"evidenceId":"EVIDENCE"}` | `{hint,session:SessionSnapshot}` | 404 чужой материал; 409 прохождение истекло/завершено |
| `POST /api/case/verdict` | `{"suspect_id":"SUSPECT"}` | `{correct,session:SessionSnapshot}` | 404 чужой подозреваемый; 409 повторный вердикт/закрытая сессия |
| `GET /api/case/progress` | — | `InvestigationProgress` | 401 нет сессии; 503 база недоступна |
| `POST /api/case/restart` | `{}` или `{"caseId":"CASE"}` | `{bundle:CaseBundle,session:SessionSnapshot}` | 401 нет сессии; 404 дело не найдено; 503 база недоступна |
| `POST /api/case/generate` | `{"mode":"auto","previousTitle":"Открытая ссылка"}` | `{bundle,generation:{mode,attempts,notice}}` | 422 неверный режим; 503 в режиме ai без ключа/после двух неудач |
| `GET /api/history` | — | массив `HistoryEntry`, до 100 | Без cookie: пустой массив; 503 база недоступна |
| `GET /api/statistics` | — | `{completed,averageScore,bestScore,averageSeconds,hintsUsed,attempts,sampleLimit:100}` | Без cookie: нулевая статистика; 503 база недоступна |

Создание дела, restart и новой сессии — 201. Восстановление существующей сессии через POST session — 200. Остальные успешные запросы — 200. Неверное обвинение — нормальный игровой результат HTTP 200 с `correct:false`, а не ошибка HTTP.

### CaseBundle

```json
{
  "source":"local",
  "case":{"id":"CASE","title":"Название","briefing":"Обстоятельства…","created_at":"2026-09-27T12:00:00.000Z"},
  "suspects":[{"id":"SUSPECT","case_id":"CASE","name":"Участник","role":"Роль","description":"Досье…"}],
  "evidence":[{"id":"EVIDENCE","case_id":"CASE","type":"log","section":"logs","title":"Журнал","subtitle":"18:10 · аудит","danger":true,"content":{"lines":[{"text":"18:10 job=JOB-123…","anomaly":true}]},"hint":"","position":0}]
}
```

`culprit_id` и `culprit_index` отсутствуют. Типы материалов: `log`, `metadata`, `network`, `testimony`; разделы: `mail`, `logs`, `files`, `people`. Содержимое имеет один из четырёх строго проверяемых форматов — см. OpenAPI. Поле `hint` публичного пакета всегда пустое. Для получения текста используйте endpoint hint.

### SessionSnapshot

```json
{
  "id":"SESSION", "revision":3, "caseId":"CASE", "caseTitle":"Название", "status":"active",
  "startedAt":"2026-09-27T12:00:00.000Z", "completedAt":null, "serverTime":"2026-09-27T12:04:00.000Z",
  "elapsedSeconds":240, "remainingSeconds":1560,
  "studiedEvidenceIds":["EVIDENCE"], "usedHintIds":["EVIDENCE"], "hints":{"EVIDENCE":"Сопоставьте журналы…"},
  "attemptedSuspectIds":["SUSPECT"], "hintsUsed":1, "attempts":1, "wrongAttempts":1,
  "score":77, "breakdown":{"base":100,"hintsPenalty":10,"timePenalty":8,"mistakesPenalty":5,"total":77},
  "progress":{"studiedEvidence":1,"totalEvidence":8,"progress":13,"hintsUsed":1,"attempts":1,"sections":{"mail":{"studied":0,"total":1},"logs":{"studied":1,"total":3},"files":{"studied":0,"total":1},"people":{"studied":0,"total":3}}},
  "efficiency":13
}
```

Статусы: `active`, `completed`, `expired`, `abandoned`. `revision` увеличивается при записи; клиент не должен заменять новый снимок более старым. После верного ответа добавляется `resolution:{suspectName,findings:[{title,detail,explanation}]}`. До успеха этого поля нет. `efficiency` обозначает полноту исследования, а не отдельный бонус.

GET не продлевает игровое время. Повторный POST session для текущего дела восстанавливает состояние, включая завершённое или просроченное; для нового прохождения нужен POST restart. Повторная запись изучения и повторная подсказка не увеличивают счётчики. Подсказки и вердикты принимаются только в активном прохождении. Restart выдаёт новый токен, сохраняет завершённые результаты и помечает прежнее активное прохождение остановленным.

### Генерация

`mode` по умолчанию `auto`; допустимы также `ai`, `local`, `fallback`. `previousTitle` — до 300 символов. `auto` при отсутствии/ошибке ИИ создаёт новый локальный сценарий и объясняет выбор в `generation.notice`. `ai` требует настройки ключа и после двух ошибок возвращает 503. Невалидный JSON не сохраняется. `fallback` использует исходный проверенный сценарий. Генерация сама не меняет текущую сессию: frontend затем вызывает POST session с новым ID.

При ошибке базы генератор сохраняет полученное содержимое локально. Локальный режим требует постоянной записываемой файловой системы одного процесса. Health сообщает `ai: configured_not_checked`, если задан ключ: платный запрос к модели не выполняется ради проверки здоровья. `database: unavailable` даёт `status: degraded`, но HTTP 200, поскольку само приложение доступно.

### История и статистика

Пример элемента истории:

```json
{"sessionId":"SESSION","caseId":"CASE","title":"Название","completedAt":"2026-09-27T12:04:00.000Z","score":77,"elapsedSeconds":240,"hintsUsed":1,"attempts":2,"studiedEvidence":7,"totalEvidence":8}
```

История ограничена 100 последними успешными прохождениями текущего анонимного посетителя. Ответ не содержит ID виновного, токенов или чужих сессий. Статистика рассчитана по этой же выборке. Очистка cookie делает старую историю недоступной в браузере.

## Коды ошибок

| HTTP | Code | Действие клиента |
| --- | --- | --- |
| 400 | `INVALID_JSON`, `INVALID_REQUEST` | Исправить тело JSON |
| 401 | `SESSION_NOT_FOUND` | Начать сессию и сохранить обе cookie |
| 403 | `ORIGIN_MISMATCH` | Отправлять запрос с того же сайта |
| 404 | `CASE_NOT_FOUND`, `EVIDENCE_NOT_FOUND`, `SUSPECT_NOT_FOUND` | Использовать ID текущего дела |
| 409 | `SESSION_EXPIRED`, `SESSION_COMPLETED` | Просмотреть результат или перезапустить дело |
| 409 | `SUSPECT_ALREADY_CHECKED` | Выбрать другого участника |
| 409 | `SESSION_CONFLICT` | Прочитать актуальную сессию и повторить действие |
| 413 | `REQUEST_TOO_LARGE` | Уменьшить тело |
| 422 | `VALIDATION_ERROR` | Исправить поле, указанное в сообщении |
| 500 | `INTERNAL_ERROR` | Повторить позднее, проверить серверные логи |
| 503 | `DATABASE_UNAVAILABLE` | Проверить базу и миграции |
| 503 | `AI_NOT_CONFIGURED`, `AI_UNAVAILABLE` | Настроить ИИ, повторить или выбрать local/fallback |
| 503 | `AI_RATE_LIMITED` | OpenRouter вернул 429; подождать или выбрать local/fallback. `details.retryAfterSeconds` передаётся, если провайдер указал задержку |
| 503 | `AI_ACCESS_DENIED`, `AI_CREDITS_REQUIRED`, `AI_MODEL_UNAVAILABLE` | Проверить доступ, баланс или выбранную модель; немедленный повтор не выполняется |

## Пример curl

```bash
curl -c cookies.txt -b cookies.txt -H "Content-Type: application/json" -d '{"mode":"local"}' http://localhost:3000/api/case/generate
# Скопируйте data.bundle.case.id из ответа вместо CASE:
curl -c cookies.txt -b cookies.txt -H "Content-Type: application/json" -d '{"caseId":"CASE"}' http://localhost:3000/api/case/session
curl -b cookies.txt http://localhost:3000/api/case/progress
```

Для Windows PowerShell проще использовать встроенную страницу `/api-test`: она не требует ручной работы с cookie и автоматически подставляет ID после GET case/generate. Отправка POST через консоль изменяет реальную игровую сессию этого браузера.
