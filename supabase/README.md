# Supabase: запуск шага 1

1. Создайте проект Supabase и примените обе миграции из `supabase/migrations` по порядку через SQL Editor (роль postgres) либо через Supabase CLI к связанному проекту. Вторая миграция добавляет `create_case_from_payload(jsonb)`, доступную только `service_role`.
2. Заполните `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` и `SUPABASE_SERVICE_ROLE_KEY`. Service role key используется только сервером, никогда не добавляйте ему префикс NEXT_PUBLIC.
3. Для шага 5 создайте собственный ключ OpenRouter и задайте `OPENROUTER_API_KEY`. Модель по умолчанию — бесплатная `google/gemma-4-26b-a4b-it:free`; при желании задайте `OPENROUTER_MODEL`. Не используйте чужие ключи и не добавляйте свой ключ в Git.
4. Проверьте ограничения доступа скриптом `supabase/tests/access-control.sql` в SQL Editor.
5. Локально выполните `node scripts/validate-fallback.mjs` и `npm run build`.

## Принятая схема

- cases: id, title, briefing, culprit_id, created_at. Правильный подозреваемый обязательно принадлежит тому же делу.
- suspects: id, case_id, name, role, description.
- evidence: id, case_id, type, section, title, subtitle, danger, content (JSONB), hint, position. Тип артефакта и вкладка независимы: письмо может быть metadata, а файл — log.
- sessions: id, case_id, token_hash, started_at, expires_at, hints_used, completed_at. Длительность — 30 минут. Только сервер управляет сессиями.
- attempts: id, session_id, case_id, suspect_id, correct, score, created_at. Один вердикт на подозреваемого в рамках сессии; сервер должен завершать сессию при успехе. Таблица закрыта, поскольку успешная попытка раскрывает ответ.
- public_cases: id, title, briefing, created_at; security_invoker=true.

Для anon/authenticated разрешено чтение только безопасных колонок cases и публичных материалов. RLS включён на всех пяти таблицах. Запись и доступ к сессиям/попыткам доступны service_role. Нет публичных RPC, позволяющих получить правильный ответ.

Fallback находится в lib, не в public. Подключать его следует через `lib/fallback-case.server.ts`, защищённый `server-only`. `culprit_index` нужен только для серверной записи и не должен сериализоваться в API-ответ. Импорт JSON напрямую в клиентский код запрещён.

Миграция создаёт структуру, но не загружает fallback: транзакционная запись дела относится к шагу 5. На шаге 1 существующий UI остаётся статичным.

Документация по ограничениям Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security
