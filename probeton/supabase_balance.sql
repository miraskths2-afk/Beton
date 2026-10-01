-- ============================================================
-- PROBETON: баланс водителя + платный Кубовик (без SMS-входа)
--
-- Что делает этот файл:
--  1. Добавляет водителям баланс (колонка app_users.balance).
--  2. Заявки на пополнение: водитель переводит деньги на Kaspi и
--     нажимает «Я перевёл», админ на Главной подтверждает.
--  3. Публикация остатка в Кубовике списывает с баланса цену
--     публикации (по умолчанию 1 000 ₸, админ меняет на Главной).
--  4. История движения денег по балансу.
--
-- Вход остаётся как сейчас (по номеру, без кода). Поэтому база,
-- как и раньше, не закрыта: это осознанный компромисс до SMS-входа.
-- Защиту базы включит отдельный файл вместе со SMS-входом.
--
-- Запускайте ПОСЛЕ supabase_master_check_v3.sql.
-- Файл можно запускать повторно.
-- Вставьте целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ===== 1. Колонки и таблицы =====

alter table app_users add column if not exists balance numeric not null default 0;

-- Настройки платформы (одна строка).
create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  leftover_post_fee numeric not null default 1000,
  kaspi_details text not null default 'Kaspi Gold PROBETON: +7 ___ ___ __ __',
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- Заявки водителей на пополнение баланса.
create table if not exists balance_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  amount numeric not null check (amount >= 500 and amount <= 500000),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- История движения денег по балансу (пополнения, списания).
create table if not exists balance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  amount numeric not null,
  kind text not null,
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);

-- ===== 2. Кубовик: публикация остатка за плату с баланса =====

create or replace function publish_leftover(
  p_user_id uuid,
  p_grade text,
  p_cubes numeric,
  p_direction text,
  p_price numeric,
  p_phone text,
  p_minutes int
)
returns leftovers
language plpgsql security definer set search_path = public as $$
declare
  v_user app_users;
  v_fee numeric;
  v_row leftovers;
begin
  select * into v_user from app_users where id = p_user_id for update;
  if not found or v_user.account_type is distinct from 'driver'
     or v_user.approval_status is distinct from 'approved' then
    raise exception 'Публиковать остатки может только одобренный водитель';
  end if;
  if p_cubes is null or p_cubes <= 0 or p_cubes > 15 then
    raise exception 'Укажите объём от 0.5 до 15 кубов';
  end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 240 then
    raise exception 'Неверное время актуальности';
  end if;
  if coalesce(trim(p_direction), '') = '' or p_price is null or p_price < 0 then
    raise exception 'Заполните направление и цену';
  end if;

  select leftover_post_fee into v_fee from app_settings where id = 1;
  v_fee := coalesce(v_fee, 0);

  if v_user.balance < v_fee then
    raise exception 'Недостаточно средств на балансе: нужно % ₸, на балансе % ₸. Пополните баланс.',
      v_fee, v_user.balance;
  end if;

  insert into leftovers (grade, cubes, direction, price, phone, driver_id,
                         driver_name, status, expires_at)
  values (p_grade, p_cubes, trim(p_direction), p_price,
          coalesce(nullif(trim(p_phone), ''), v_user.phone),
          v_user.id::text,
          coalesce(v_user.full_name, v_user.driver_name, ''),
          'available',
          now() + make_interval(mins => p_minutes))
  returning * into v_row;

  if v_fee > 0 then
    update app_users set balance = balance - v_fee where id = v_user.id;
    insert into balance_transactions (user_id, amount, kind, ref_id, note)
    values (v_user.id, -v_fee, 'leftover_post', v_row.id,
            'Публикация остатка ' || coalesce(p_grade, '') || ', ' || p_cubes || ' м³');
  end if;

  return v_row;
end;
$$;

-- ===== 3. Баланс: заявка на пополнение и подтверждение админом =====

create or replace function request_topup(p_user_id uuid, p_amount numeric)
returns balance_topups
language plpgsql security definer set search_path = public as $$
declare
  v_row balance_topups;
begin
  if not exists (select 1 from app_users where id = p_user_id) then
    raise exception 'Войдите в аккаунт';
  end if;
  if (select count(*) from balance_topups
      where user_id = p_user_id and status = 'pending') >= 3 then
    raise exception 'У вас уже есть заявки на проверке — дождитесь подтверждения';
  end if;
  insert into balance_topups (user_id, amount)
  values (p_user_id, p_amount)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function review_topup(p_admin_id uuid, p_id uuid, p_approve boolean)
returns balance_topups
language plpgsql security definer set search_path = public as $$
declare
  v_row balance_topups;
begin
  if not exists (select 1 from app_users where id = p_admin_id and role = 'admin') then
    raise exception 'Только администратор';
  end if;
  select * into v_row from balance_topups where id = p_id for update;
  if not found or v_row.status <> 'pending' then
    raise exception 'Заявка уже обработана';
  end if;

  update balance_topups
  set status = case when p_approve then 'confirmed' else 'rejected' end,
      confirmed_at = now()
  where id = p_id
  returning * into v_row;

  if p_approve then
    update app_users set balance = balance + v_row.amount where id = v_row.user_id;
    insert into balance_transactions (user_id, amount, kind, ref_id, note)
    values (v_row.user_id, v_row.amount, 'topup', v_row.id, 'Пополнение через Kaspi');
  end if;
  return v_row;
end;
$$;

grant execute on function publish_leftover(uuid, text, numeric, text, numeric, text, int) to anon, authenticated;
grant execute on function request_topup(uuid, numeric) to anon, authenticated;
grant execute on function review_topup(uuid, uuid, boolean) to anon, authenticated;

-- ===== 4. Доступ (как у остальных таблиц: открыт для сайта) =====

alter table app_settings enable row level security;
alter table balance_topups enable row level security;
alter table balance_transactions enable row level security;

drop policy if exists "app_settings_select" on app_settings;
drop policy if exists "app_settings_update" on app_settings;
create policy "app_settings_select" on app_settings for select using (true);
create policy "app_settings_update" on app_settings for update using (true) with check (true);

-- Заявки и история меняются только через функции выше.
drop policy if exists "balance_topups_select" on balance_topups;
create policy "balance_topups_select" on balance_topups for select using (true);
drop policy if exists "balance_transactions_select" on balance_transactions;
create policy "balance_transactions_select" on balance_transactions for select using (true);

do $$ begin
  alter publication supabase_realtime add table balance_topups;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table app_users;
exception when duplicate_object then null; end $$;

-- ===== Проверьте после запуска: =====
-- Table Editor -> app_settings: одна строка, впишите свои реквизиты
-- Kaspi в kaspi_details (или на Главной админа -> «Цена публикации
-- остатка»).
