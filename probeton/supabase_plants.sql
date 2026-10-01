-- ============================================================
-- PROBETON: роль «Завод / БСУ» и парк миксеристов
--
-- Что делает этот файл:
--  1. Аккаунт завода — это обычная строка в app_users с
--     account_type = 'plant'. Добавляет заводу адрес и точку на
--     карте (plant_address, plant_lat, plant_lng) и отметку
--     «работает / не работает» (plant_active).
--  2. Парк завода: у миксериста появляется plant_id — id завода,
--     к которому он прикреплён. Пусто = независимый миксерист.
--  3. У заявки появляется plant_id / plant_name — завод, которому
--     передана заявка (админом или завод сам принял её из ленты).
--  4. Проверки в базе:
--     - в парк можно добавить только миксериста и только к заводу;
--     - миксерист на заявке завода должен быть из парка этого завода;
--     - если аккаунт перестаёт быть заводом, его парк и ещё не
--       начатые заявки автоматически освобождаются.
--
-- Вход остаётся как сейчас (по номеру, без кода), поэтому эти
-- проверки защищают от ошибок, а не от взлома (как и в
-- supabase_balance.sql).
--
-- Запускайте ПОСЛЕ supabase_master_check_v3.sql (и после файлов
-- из PR #3, если они уже выполнены — порядок между ними не важен).
-- Файл можно запускать повторно.
-- Вставьте целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

-- ===== 1. Колонки =====

alter table app_users add column if not exists plant_id uuid
  references app_users(id) on delete set null;
alter table app_users add column if not exists plant_address text;
alter table app_users add column if not exists plant_lat double precision;
alter table app_users add column if not exists plant_lng double precision;
alter table app_users add column if not exists plant_active boolean not null default true;

alter table orders add column if not exists plant_id uuid
  references app_users(id) on delete set null;
alter table orders add column if not exists plant_name text;

create index if not exists app_users_plant_id_idx on app_users (plant_id);
create index if not exists orders_plant_id_idx on orders (plant_id);

-- ===== 2. Парк: только миксерист и только к заводу =====

create or replace function app_users_plant_check()
returns trigger
language plpgsql as $$
begin
  if new.plant_id is not null then
    if new.plant_id = new.id then
      raise exception 'Аккаунт не может быть в парке сам у себя';
    end if;
    if new.account_type is distinct from 'driver' then
      raise exception 'В парк завода можно добавить только миксериста';
    end if;
    if not exists (
      select 1 from app_users where id = new.plant_id and account_type = 'plant'
    ) then
      raise exception 'Миксериста можно добавить только в парк завода';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists app_users_plant_check on app_users;
create trigger app_users_plant_check
  before insert or update of plant_id, account_type on app_users
  for each row execute function app_users_plant_check();

-- Аккаунт перестал быть заводом -> освобождаем его парк и заявки,
-- по которым ещё не выделен миксер.
create or replace function app_users_plant_released()
returns trigger
language plpgsql as $$
begin
  if old.account_type = 'plant' and new.account_type is distinct from 'plant' then
    update app_users set plant_id = null where plant_id = new.id;
    update orders set plant_id = null, plant_name = null
      where plant_id = new.id and driver_id is null and status = 'new';
  end if;
  return new;
end $$;

drop trigger if exists app_users_plant_released on app_users;
create trigger app_users_plant_released
  after update of account_type on app_users
  for each row execute function app_users_plant_released();

-- ===== 3. Заявка завода: миксерист только из его парка =====

create or replace function orders_plant_check()
returns trigger
language plpgsql as $$
declare
  v_driver_plant uuid;
begin
  if new.plant_id is not null and new.driver_id is not null and (
    tg_op = 'INSERT'
    or new.driver_id is distinct from old.driver_id
    or new.plant_id is distinct from old.plant_id
  ) then
    select plant_id into v_driver_plant
      from app_users where id::text = new.driver_id;
    if v_driver_plant is distinct from new.plant_id then
      raise exception 'Этот миксерист не состоит в парке завода, которому передана заявка';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_plant_check on orders;
create trigger orders_plant_check
  before insert or update of plant_id, driver_id on orders
  for each row execute function orders_plant_check();

-- Обновить кэш схемы, чтобы сайт сразу увидел новые колонки.
notify pgrst, 'reload schema';
