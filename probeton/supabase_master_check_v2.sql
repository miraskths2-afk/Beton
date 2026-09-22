-- ============================================================
-- ФИНАЛЬНАЯ ОБЩАЯ ПРОВЕРКА БАЗЫ ДАННЫХ PROBETON (версия 2)
-- Включает вообще всё, что добавлялось за всё время работы,
-- включая последние правки (оплата водителя, история, карта
-- доставки, повторное одобрение, удаление водителей).
-- Полностью безопасно запускать даже повторно.
-- Вставьте целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ===== Базовые таблицы =====

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  phone text unique not null,
  role text not null default 'user',
  account_type text,
  driver_name text,
  vehicle_plate text,
  equipment_type text,
  approval_status text not null default 'pending'
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  order_number text,
  what_needed text not null,
  phone text not null,
  order_type text not null default 'quick',
  grade text,
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
  status text not null default 'available',
  intercepted_by_phone text
);

create table if not exists blacklist (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  phone text not null,
  reason text
);

create table if not exists driver_locations (
  driver_id uuid primary key,
  driver_name text,
  lat double precision not null,
  lng double precision not null,
  is_online boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ===== Поля, добавленные поверх базовых таблиц =====

alter table app_users add column if not exists full_name text;
alter table app_users add column if not exists terms_accepted boolean not null default false;
alter table app_users add column if not exists terms_version text;
alter table app_users add column if not exists notifications_enabled boolean not null default true;

alter table orders add column if not exists needed_by timestamptz;
alter table orders add column if not exists comment text;
alter table orders add column if not exists driver_paid boolean not null default false;
alter table orders add column if not exists driver_payment_confirmed boolean not null default false;
alter table orders add column if not exists delivery_lat double precision;
alter table orders add column if not exists delivery_lng double precision;
alter table orders add column if not exists accepted_at timestamptz;
alter table orders add column if not exists completed_at timestamptz;

alter table leftovers add column if not exists expires_at timestamptz;
alter table leftovers add column if not exists intercepted_lat double precision;
alter table leftovers add column if not exists intercepted_lng double precision;

-- ===== Права доступа (RLS) =====

alter table app_users enable row level security;
alter table orders enable row level security;
alter table leftovers enable row level security;
alter table blacklist enable row level security;
alter table driver_locations enable row level security;

drop policy if exists "app_users_all" on app_users;
drop policy if exists "app_users_select" on app_users;
drop policy if exists "app_users_insert" on app_users;
drop policy if exists "app_users_update" on app_users;
drop policy if exists "app_users_delete" on app_users;
create policy "app_users_select" on app_users for select using (true);
create policy "app_users_insert" on app_users for insert with check (true);
create policy "app_users_update" on app_users for update using (true) with check (true);
-- Удалять можно только обычные аккаунты (заказчиков/водителей) — админ защищён.
create policy "app_users_delete" on app_users for delete using (role <> 'admin');

drop policy if exists "orders_all" on orders;
create policy "orders_all" on orders for all using (true) with check (true);

drop policy if exists "leftovers_all" on leftovers;
drop policy if exists "leftovers_select" on leftovers;
drop policy if exists "leftovers_insert" on leftovers;
drop policy if exists "leftovers_update" on leftovers;
create policy "leftovers_select" on leftovers for select using (true);
create policy "leftovers_insert" on leftovers for insert with check (true);
create policy "leftovers_update" on leftovers for update using (true) with check (true);

drop policy if exists "blacklist_all" on blacklist;
create policy "blacklist_all" on blacklist for all using (true) with check (true);

drop policy if exists "driver_locations_all" on driver_locations;
drop policy if exists "driver_locations_select" on driver_locations;
drop policy if exists "driver_locations_insert" on driver_locations;
drop policy if exists "driver_locations_update" on driver_locations;
drop policy if exists "driver_locations_delete" on driver_locations;
create policy "driver_locations_select" on driver_locations for select using (true);
create policy "driver_locations_insert" on driver_locations for insert with check (true);
create policy "driver_locations_update" on driver_locations for update using (true) with check (true);
create policy "driver_locations_delete" on driver_locations for delete using (true);

-- Запрет смены роли на admin кем угодно, кроме вас напрямую через Supabase.
create or replace function block_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'Изменение роли через сайт запрещено. Меняйте role только через Supabase.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_role_escalation on app_users;
create trigger trg_block_role_escalation
before update on app_users
for each row
execute function block_role_escalation();

-- ===== Разовая миграция: одобряем уже существующих заказчиков =====
-- (чтобы никого не заблокировать задним числом новым правилом
-- повторного одобрения после выхода из аккаунта)

update app_users
set approval_status = 'approved'
where role <> 'admin'
  and (account_type is distinct from 'driver')
  and approval_status = 'pending';

-- ===== Realtime =====

do $$ begin alter publication supabase_realtime add table orders;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table leftovers;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table blacklist;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table app_users;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table driver_locations;
exception when duplicate_object then null; end $$;

-- ===== Готово. Проверьте в Table Editor: =====
-- orders: needed_by, comment, driver_paid, driver_payment_confirmed,
--         delivery_lat, delivery_lng, accepted_at, completed_at
-- leftovers: expires_at, intercepted_lat, intercepted_lng
-- app_users: full_name, terms_accepted, terms_version,
--            notifications_enabled
