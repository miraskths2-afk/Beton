-- Добавляет поле для дополнительного комментария к заказу.
-- Вставьте в Supabase -> SQL Editor -> Run (можно запускать повторно).
alter table orders add column if not exists comment text;
