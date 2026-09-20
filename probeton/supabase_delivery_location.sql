-- Координаты места доставки, выбранные клиентом на карте при заказе.
-- Вставьте в Supabase -> SQL Editor -> Run (можно запускать повторно).
alter table orders add column if not exists delivery_lat double precision;
alter table orders add column if not exists delivery_lng double precision;
