-- Оплата сервисного сбора самим водителем перед завершением заказа,
-- подтверждается менеджером/админом.
-- Вставьте в Supabase -> SQL Editor -> Run (можно запускать повторно).

alter table orders add column if not exists driver_paid boolean not null default false;
alter table orders add column if not exists driver_payment_confirmed boolean not null default false;
