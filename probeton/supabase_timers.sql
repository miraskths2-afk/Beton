-- Добавляет поля для таймеров: желаемое время заказа у клиента
-- и время истечения актуальности остатка у водителя.
-- Вставьте в Supabase -> SQL Editor -> Run (можно запускать повторно).

alter table orders add column if not exists needed_by timestamptz;
alter table leftovers add column if not exists expires_at timestamptz;
