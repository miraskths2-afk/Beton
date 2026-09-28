-- ============================================================
-- PROBETON: безопасность + баланс водителя + платный Кубовик (v4)
--
-- Что делает этот файл:
--  1. Вход по SMS-коду через Supabase Auth: аккаунт в app_users
--     привязывается к подтверждённому номеру (колонка auth_id).
--  2. Закрывает базу: без входа по SMS нельзя ничего прочитать или
--     изменить; каждый видит и меняет только своё, админ — всё.
--  3. Деньги и статусы меняются только по правилам на сервере:
--     клиент не может сам отметить «сбор подтверждён», водитель не
--     может закрыть заказ в обход оплаты, никто не может сам себе
--     начислить баланс.
--  4. Баланс водителя: пополнение (через Kaspi, админ подтверждает)
--     и списание за публикацию остатка в Кубовике.
--
-- ВАЖНО: запускайте ПОСЛЕ supabase_master_check_v3.sql и только
-- вместе с новой версией сайта (вход по SMS). Старая версия сайта
-- после этого файла перестанет видеть данные — так и задумано.
-- Файл можно запускать повторно.
-- Вставьте целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ===== 1. Новые колонки и таблицы =====

alter table app_users add column if not exists auth_id uuid unique;
alter table app_users add column if not exists balance numeric not null default 0;

alter table orders add column if not exists client_id uuid;

-- Настройки платформы (одна строка). Меняет только админ.
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

-- ===== 2. Вспомогательные функции =====

-- Последние 10 цифр номера: "+7 700 123-45-67", "87001234567" и
-- "77001234567" считаются одним номером.
create or replace function norm_phone(p text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10)
$$;

-- Номер, подтверждённый SMS-кодом (из токена Supabase Auth).
create or replace function my_phone()
returns text language sql stable as $$
  select nullif(norm_phone(auth.jwt() ->> 'phone'), '')
$$;

-- id текущего пользователя в app_users (или null, если не вошёл).
create or replace function my_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from app_users where auth_id = auth.uid() and auth.uid() is not null limit 1
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users
    where auth_id = auth.uid() and auth.uid() is not null and role = 'admin'
  )
$$;

create or replace function is_approved_driver()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users
    where auth_id = auth.uid() and auth.uid() is not null
      and account_type = 'driver' and approval_status = 'approved'
  )
$$;

-- «Доверенный» доступ: админ, service_role, прямой SQL (SQL Editor,
-- pg_cron — там запроса от сайта нет вообще) или изменение, которое
-- делает одна из серверных функций ниже (они включают флаг
-- probeton.bypass только на время своей работы).
create or replace function is_trusted()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.jwt() is null
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or coalesce(current_setting('probeton.bypass', true), '') = 'on'
      or is_admin()
$$;

-- ===== 3. Вход: привязка аккаунта к номеру из SMS =====
-- Сайт вызывает её сразу после ввода правильного кода. Находит
-- существующий аккаунт по номеру (старые аккаунты не теряются) или
-- создаёт новый.
create or replace function claim_account(p_account_type text default 'client')
returns app_users
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := my_phone();
  v_user app_users;
begin
  if auth.uid() is null or v_phone is null then
    raise exception 'Войдите по SMS-коду';
  end if;

  select * into v_user from app_users where auth_id = auth.uid();
  if found then
    return v_user;
  end if;

  perform set_config('probeton.bypass', 'on', true);

  select * into v_user from app_users
  where norm_phone(phone) = v_phone and auth_id is null
  order by (role = 'admin') desc, created_date asc
  limit 1
  for update;

  if found then
    update app_users set auth_id = auth.uid() where id = v_user.id
    returning * into v_user;
    -- Старые заказы этого номера — в «мои заказы».
    if v_user.role <> 'admin' then
      update orders set client_id = v_user.id
      where client_id is null and norm_phone(phone) = v_phone;
    end if;
    return v_user;
  end if;

  insert into app_users (phone, role, account_type, approval_status, auth_id)
  values (
    '7' || v_phone,
    'user',
    case when p_account_type = 'driver' then 'driver' else 'client' end,
    case when p_account_type = 'driver' then 'pending' else 'approved' end,
    auth.uid()
  )
  returning * into v_user;
  return v_user;
end;
$$;

-- Проверка чёрного списка без выдачи самого списка в браузер.
create or replace function is_blacklisted(p_phone text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blacklist
    where norm_phone(phone) = norm_phone(p_phone) and norm_phone(p_phone) <> ''
  )
$$;

-- ===== 4. Защита полей app_users =====
create or replace function protect_app_users()
returns trigger language plpgsql as $$
begin
  if is_trusted() then
    return new;
  end if;
  if new.phone is distinct from old.phone
     or new.auth_id is distinct from old.auth_id
     or new.balance is distinct from old.balance
     or new.account_type is distinct from old.account_type then
    raise exception 'Это поле меняет только администратор';
  end if;
  -- Сам себе пользователь может только сбросить одобрение (при выходе),
  -- но не выдать его.
  if new.approval_status is distinct from old.approval_status
     and new.approval_status <> 'pending' then
    raise exception 'Одобрение выдаёт только администратор';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_app_users on app_users;
create trigger trg_protect_app_users
before update on app_users
for each row execute function protect_app_users();

-- ===== 5. Защита заказов =====

-- Привязываем старые заказы к клиентам по номеру телефона.
update orders o
set client_id = u.id
from app_users u
where o.client_id is null
  and norm_phone(o.phone) = norm_phone(u.phone)
  and u.role <> 'admin';

create or replace function protect_orders_insert()
returns trigger language plpgsql as $$
begin
  if is_trusted() then
    return new;
  end if;
  if is_blacklisted(new.phone) or is_blacklisted(my_phone()) then
    raise exception 'Этот номер в чёрном списке PROBETON. Заказ недоступен.';
  end if;
  new.client_id := my_user_id();
  new.status := 'new';
  new.driver_id := null;
  new.driver_name := null;
  new.accepted_at := null;
  new.completed_at := null;
  new.client_paid := false;
  new.commission_paid := false;
  new.driver_paid := false;
  new.driver_payment_confirmed := false;
  return new;
end;
$$;

drop trigger if exists trg_protect_orders_insert on orders;
create trigger trg_protect_orders_insert
before insert on orders
for each row execute function protect_orders_insert();

create or replace function protect_orders_update()
returns trigger language plpgsql as $$
declare
  v_me uuid := my_user_id();
  v_is_client boolean;
  v_is_driver boolean;
begin
  if is_trusted() then
    return new;
  end if;

  v_is_client := old.client_id = v_me or norm_phone(old.phone) = my_phone();
  v_is_driver := old.driver_id = v_me::text;

  -- Подтверждения оплаты — только админ.
  if new.commission_paid is distinct from old.commission_paid
     or new.driver_payment_confirmed is distinct from old.driver_payment_confirmed
     or new.client_id is distinct from old.client_id
     or new.order_number is distinct from old.order_number
     or new.phone is distinct from old.phone then
    raise exception 'Это меняет только администратор';
  end if;

  -- Объём и марку нельзя менять после того, как заказ взят
  -- (от объёма считается сбор).
  if old.status <> 'new' and (
       new.cubes is distinct from old.cubes
       or new.grade is distinct from old.grade) then
    raise exception 'Объём и марку нельзя менять после принятия заказа';
  end if;

  -- Водитель берёт свободный заказ.
  if old.status = 'new' and old.driver_id is null
     and new.driver_id is not null then
    if not is_approved_driver() or new.driver_id <> v_me::text
       or new.status <> 'in_progress' then
      raise exception 'Взять заказ может только одобренный водитель';
    end if;
    return new;
  end if;

  if new.driver_id is distinct from old.driver_id
     or new.driver_name is distinct from old.driver_name then
    raise exception 'Назначить водителя может только администратор';
  end if;

  if new.status is distinct from old.status then
    -- Клиент может только отменить свой незавершённый заказ.
    if not (v_is_client and new.status = 'cancelled'
            and old.status not in ('done', 'cancelled')) then
      raise exception 'Статус заказа меняет администратор';
    end if;
  end if;

  if new.client_paid is distinct from old.client_paid
     or new.client_rating is distinct from old.client_rating then
    if not v_is_client then
      raise exception 'Это может отметить только заказчик';
    end if;
  end if;

  if new.driver_paid is distinct from old.driver_paid
     or new.driver_rating is distinct from old.driver_rating then
    if not v_is_driver then
      raise exception 'Это может отметить только водитель заказа';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_orders_update on orders;
create trigger trg_protect_orders_update
before update on orders
for each row execute function protect_orders_update();

-- ===== 6. Кубовик: публикация остатка за плату с баланса =====

create or replace function publish_leftover(
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
  select * into v_user from app_users where auth_id = auth.uid() for update;
  if not found or v_user.account_type <> 'driver'
     or v_user.approval_status <> 'approved' then
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
    perform set_config('probeton.bypass', 'on', true);
    update app_users set balance = balance - v_fee where id = v_user.id;
    insert into balance_transactions (user_id, amount, kind, ref_id, note)
    values (v_user.id, -v_fee, 'leftover_post', v_row.id,
            'Публикация остатка ' || coalesce(p_grade, '') || ', ' || p_cubes || ' м³');
  end if;

  return v_row;
end;
$$;

create or replace function protect_leftovers_update()
returns trigger language plpgsql as $$
declare
  v_owner boolean := old.driver_id = my_user_id()::text;
begin
  if is_trusted() then
    return new;
  end if;

  -- Оплаченную публикацию нельзя «переписать» под новый остаток.
  if new.grade is distinct from old.grade
     or new.cubes is distinct from old.cubes
     or new.direction is distinct from old.direction
     or new.price is distinct from old.price
     or new.driver_id is distinct from old.driver_id
     or new.expires_at is distinct from old.expires_at
     or new.created_date is distinct from old.created_date then
    raise exception 'Опубликованный остаток нельзя изменить — опубликуйте новый';
  end if;

  if v_owner then
    if old.status = 'gone' and new.status is distinct from old.status then
      raise exception 'Завершённый остаток нельзя открыть заново';
    end if;
    return new;
  end if;

  -- Прораб перехватывает свободный и не истёкший остаток.
  if old.status = 'available' and new.status = 'intercepted'
     and (old.expires_at is null or old.expires_at > now())
     and new.phone is not distinct from old.phone
     and new.driver_name is not distinct from old.driver_name
     and new.completed_at is not distinct from old.completed_at then
    return new;
  end if;

  raise exception 'Нет прав на изменение этого остатка';
end;
$$;

drop trigger if exists trg_protect_leftovers_update on leftovers;
create trigger trg_protect_leftovers_update
before update on leftovers
for each row execute function protect_leftovers_update();

-- ===== 7. Баланс: заявки на пополнение и подтверждение админом =====

create or replace function request_topup(p_amount numeric)
returns balance_topups
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := my_user_id();
  v_row balance_topups;
begin
  if v_me is null then
    raise exception 'Войдите в аккаунт';
  end if;
  if (select count(*) from balance_topups
      where user_id = v_me and status = 'pending') >= 3 then
    raise exception 'У вас уже есть заявки на проверке — дождитесь подтверждения';
  end if;
  insert into balance_topups (user_id, amount)
  values (v_me, p_amount)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function review_topup(p_id uuid, p_approve boolean)
returns balance_topups
language plpgsql security definer set search_path = public as $$
declare
  v_row balance_topups;
begin
  if not is_trusted() then
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
    perform set_config('probeton.bypass', 'on', true);
    update app_users set balance = balance + v_row.amount where id = v_row.user_id;
    insert into balance_transactions (user_id, amount, kind, ref_id, note)
    values (v_row.user_id, v_row.amount, 'topup', v_row.id, 'Пополнение через Kaspi');
  end if;
  return v_row;
end;
$$;

-- Ручная корректировка баланса админом (возврат, бонус, штраф).
create or replace function adjust_balance(p_user_id uuid, p_amount numeric, p_note text)
returns app_users
language plpgsql security definer set search_path = public as $$
declare
  v_user app_users;
begin
  if not is_trusted() then
    raise exception 'Только администратор';
  end if;
  perform set_config('probeton.bypass', 'on', true);
  update app_users set balance = balance + p_amount where id = p_user_id
  returning * into v_user;
  insert into balance_transactions (user_id, amount, kind, note)
  values (p_user_id, p_amount, 'adjust', p_note);
  return v_user;
end;
$$;

-- ===== 8. Права доступа (RLS) =====
-- Все политики — только для вошедших по SMS (роль authenticated).
-- Анонимный ключ из браузера сам по себе больше ничего не даёт.

alter table app_settings enable row level security;
alter table balance_topups enable row level security;
alter table balance_transactions enable row level security;

-- app_users: себя, админ всех, водителей видят все вошедшие
-- (имя/фото/телефон водителя нужны заказчику в заказе).
drop policy if exists "app_users_select" on app_users;
drop policy if exists "app_users_insert" on app_users;
drop policy if exists "app_users_update" on app_users;
drop policy if exists "app_users_delete" on app_users;
create policy "app_users_select" on app_users for select to authenticated
  using (auth_id = auth.uid() or is_admin() or account_type = 'driver');
create policy "app_users_update" on app_users for update to authenticated
  using (auth_id = auth.uid() or is_admin())
  with check (auth_id = auth.uid() or is_admin());
create policy "app_users_delete" on app_users for delete to authenticated
  using (is_admin() and role <> 'admin');

-- orders
drop policy if exists "orders_all" on orders;
drop policy if exists "orders_select" on orders;
drop policy if exists "orders_insert" on orders;
drop policy if exists "orders_update" on orders;
drop policy if exists "orders_delete" on orders;
create policy "orders_select" on orders for select to authenticated
  using (
    is_admin()
    or client_id = my_user_id()
    or norm_phone(phone) = my_phone()
    or driver_id = my_user_id()::text
    or (status = 'new' and driver_id is null and is_approved_driver())
  );
create policy "orders_insert" on orders for insert to authenticated
  with check (my_user_id() is not null);
create policy "orders_update" on orders for update to authenticated
  using (
    is_admin()
    or client_id = my_user_id()
    or norm_phone(phone) = my_phone()
    or driver_id = my_user_id()::text
    or (status = 'new' and driver_id is null and is_approved_driver())
  )
  with check (true);
create policy "orders_delete" on orders for delete to authenticated
  using (is_admin());

-- leftovers: ленту видят все вошедшие; добавить можно только через
-- publish_leftover (с оплатой), напрямую — только админ.
drop policy if exists "leftovers_all" on leftovers;
drop policy if exists "leftovers_select" on leftovers;
drop policy if exists "leftovers_insert" on leftovers;
drop policy if exists "leftovers_update" on leftovers;
drop policy if exists "leftovers_delete" on leftovers;
create policy "leftovers_select" on leftovers for select to authenticated
  using (true);
create policy "leftovers_insert" on leftovers for insert to authenticated
  with check (is_admin());
create policy "leftovers_update" on leftovers for update to authenticated
  using (true) with check (true);
create policy "leftovers_delete" on leftovers for delete to authenticated
  using (is_admin() or driver_id = my_user_id()::text);

-- blacklist: видит и чистит только админ; водитель может пожаловаться.
drop policy if exists "blacklist_all" on blacklist;
drop policy if exists "blacklist_select" on blacklist;
drop policy if exists "blacklist_insert" on blacklist;
drop policy if exists "blacklist_delete" on blacklist;
create policy "blacklist_select" on blacklist for select to authenticated
  using (is_admin());
create policy "blacklist_insert" on blacklist for insert to authenticated
  with check (is_admin() or is_approved_driver());
create policy "blacklist_delete" on blacklist for delete to authenticated
  using (is_admin());

-- driver_locations: точки на карте видят все вошедшие, писать — только своё.
drop policy if exists "driver_locations_all" on driver_locations;
drop policy if exists "driver_locations_select" on driver_locations;
drop policy if exists "driver_locations_insert" on driver_locations;
drop policy if exists "driver_locations_update" on driver_locations;
drop policy if exists "driver_locations_delete" on driver_locations;
create policy "driver_locations_select" on driver_locations for select to authenticated
  using (true);
create policy "driver_locations_insert" on driver_locations for insert to authenticated
  with check (driver_id = my_user_id() and is_approved_driver());
create policy "driver_locations_update" on driver_locations for update to authenticated
  using (driver_id = my_user_id() or is_admin())
  with check (driver_id = my_user_id() or is_admin());
create policy "driver_locations_delete" on driver_locations for delete to authenticated
  using (driver_id = my_user_id() or is_admin());

-- order_messages: только участники заказа (кто видит заказ) и админ.
drop policy if exists "order_messages_all" on order_messages;
drop policy if exists "order_messages_select" on order_messages;
drop policy if exists "order_messages_insert" on order_messages;
create policy "order_messages_select" on order_messages for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id));
create policy "order_messages_insert" on order_messages for insert to authenticated
  with check (exists (select 1 from orders o where o.id = order_id));

-- Настройки: читают все вошедшие, меняет админ.
drop policy if exists "app_settings_select" on app_settings;
drop policy if exists "app_settings_update" on app_settings;
create policy "app_settings_select" on app_settings for select to authenticated
  using (true);
create policy "app_settings_update" on app_settings for update to authenticated
  using (is_admin()) with check (is_admin());

-- Пополнения и история: свои или админ. Создаются и меняются только
-- через функции выше.
drop policy if exists "balance_topups_select" on balance_topups;
create policy "balance_topups_select" on balance_topups for select to authenticated
  using (user_id = my_user_id() or is_admin());
drop policy if exists "balance_transactions_select" on balance_transactions;
create policy "balance_transactions_select" on balance_transactions for select to authenticated
  using (user_id = my_user_id() or is_admin());

-- Фото водителей: загружать могут только вошедшие.
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');
create policy "avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars');

-- Функции для сайта: вызывать могут только вошедшие.
revoke execute on function claim_account(text) from public, anon;
revoke execute on function publish_leftover(text, numeric, text, numeric, text, int) from public, anon;
revoke execute on function request_topup(numeric) from public, anon;
revoke execute on function review_topup(uuid, boolean) from public, anon;
revoke execute on function adjust_balance(uuid, numeric, text) from public, anon;
revoke execute on function is_blacklisted(text) from public, anon;
grant execute on function claim_account(text) to authenticated;
grant execute on function publish_leftover(text, numeric, text, numeric, text, int) to authenticated;
grant execute on function request_topup(numeric) to authenticated;
grant execute on function review_topup(uuid, boolean) to authenticated;
grant execute on function adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function is_blacklisted(text) to authenticated;

-- ===== 9. Realtime для новых таблиц =====
do $$ begin alter publication supabase_realtime add table balance_topups;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table app_settings;
exception when duplicate_object then null; end $$;

-- ===== Готово =====
-- Проверьте: Table Editor -> app_settings (одна строка: цена публикации
-- остатка и реквизиты Kaspi — поменяйте реквизиты на свои).
