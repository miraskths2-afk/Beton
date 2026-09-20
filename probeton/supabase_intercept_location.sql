-- Координаты места, откуда прораб перехватил остаток (для водителя).
-- Вставьте в Supabase -> SQL Editor -> Run (можно запускать повторно).
alter table leftovers add column if not exists intercepted_lat double precision;
alter table leftovers add column if not exists intercepted_lng double precision;
