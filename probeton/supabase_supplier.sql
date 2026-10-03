-- Версия 2.0: роль «Поставщик» (бетонный завод, который продаёт бетон
-- миксеристам). Это НЕ старая роль «Завод»: поставщик не видит заявок
-- и клиентов, только миксеристов на линии.
--
-- Аккаунт поставщика: app_users.account_type = 'supplier'.
-- Новые колонки (безопасно выполнять повторно):
--   supplier_company  — название завода
--   supplier_address  — адрес завода (определяется по точке на карте)
--   supplier_lat/lng  — точка завода на карте
--   supplier_products — что продаёт: [{"grade":"М300","price":24000}, ...]
--                       price — цена за 1 м³ в тенге, может быть пустой

alter table public.app_users add column if not exists supplier_company text;
alter table public.app_users add column if not exists supplier_address text;
alter table public.app_users add column if not exists supplier_lat double precision;
alter table public.app_users add column if not exists supplier_lng double precision;
alter table public.app_users add column if not exists supplier_products jsonb not null default '[]'::jsonb;
