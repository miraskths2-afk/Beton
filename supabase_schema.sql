-- ============================================================
-- Схема базы данных PROBETON для Supabase
-- Вставьте это целиком в Supabase -> SQL Editor -> Run
-- ============================================================

create extension if not exists "pgcrypto";

-- Пользователи (клиенты и водители)
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  phone text unique not null,
  role text not null default 'user', -- 'admin' | 'user' | 'Завод'
  account_type text,                 -- 'client' | 'driver'
  driver_name text,
  vehicle_plate text,
  equipment_type text,               -- 'mixer' | 'pump_16' | 'pump_24' | 'pump_36' | 'pump_52'
  approval_status text not null default 'pending' -- 'pending' | 'approved' | 'rejected'
);

-- Заказы
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  order_number text,
  what_needed text not null,
  phone text not null,
  order_type text not null default 'quick', -- 'quick' | 'calculator'
  grade text,                                -- 'М150' | 'М200' | 'М300' | 'М400'
  price_per_cube numeric,
  cubes numeric,
  total numeric,
  delivery_address text,
  mixer_time text,
  status text not null default 'new',
  driver_id text,
  driver_name text,
  client_paid boolean not null default false,
  commission_paid boolean not null default false,
  client_rating numeric,
  driver_rating numeric
);

-- Остатки бетона
create table if not exists leftovers (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  grade text,
  cubes numeric,
  direction text,
  price numeric,
  driver_id text,
  driver_name text,
  phone text,
  status text not null default 'available', -- 'available' | 'intercepted' | 'gone'
  intercepted_by_phone text
);

-- Чёрный список номеров
create table if not exists blacklist (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  phone text not null,
  reason text
);

-- ============================================================
-- Включаем Row Level Security + открытые политики.
--
-- ВАЖНО: это упрощённая схема без пароля — вход только по номеру
-- телефона (по вашему выбору). Это значит, что любой человек,
-- знающий адрес вашего Supabase-проекта и публичный ключ, теоретически
-- может читать/писать данные напрямую через API, а не только через
-- сайт. Для внутреннего рабочего инструмента с небольшим числом
-- пользователей это обычно приемлемый компромисс ради простоты.
-- Если позже понадобится больше защиты — можно donbavit пароль
-- через Supabase Auth, не переделывая всю структуру.
-- ============================================================

alter table app_users enable row level security;
alter table orders enable row level security;
alter table leftovers enable row level security;
alter table blacklist enable row level security;

create policy "app_users_all" on app_users for all using (true) with check (true);
create policy "orders_all" on orders for all using (true) with check (true);
create policy "leftovers_all" on leftovers for all using (true) with check (true);
create policy "blacklist_all" on blacklist for all using (true) with check (true);

-- Включаем realtime (чтобы обновления заказов приходили "вживую", как было в Base44)
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table leftovers;
alter publication supabase_realtime add table blacklist;
alter publication supabase_realtime add table app_users;
