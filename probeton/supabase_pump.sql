-- =====================================================================
-- PROBETON: роль «АБН / насосник» и заказ автобетононасоса
-- =====================================================================
-- Что делает:
--   1. Новый тип аккаунта account_type = 'pump' (насосник АБН).
--      Насосника, как и миксериста, можно добавить в парк завода.
--   2. Заявка на АБН — обычная строка в orders с service_type = 'pump':
--      длина стрелы, сколько часов (минимум 3), цена за час, предоплата.
--      Если АБН заказан вместе с бетоном, pump_for_order_id указывает
--      на заявку бетона.
--   3. Завод может «нанять насосника на сайте» (pump_hire_open) —
--      заявка завода появляется в ленте у всех насосников.
--   4. Отдельный чат «завод ↔ свой миксерист / насосник»
--      (channel = 'fleet'). Клиент в заявке завода пишет только заводу.
--   5. Цены АБН по длине стрелы — в настройках (app_settings.pump_rates),
--      меняет админ на странице «Партнёры» → «АБН».
--
-- Можно запускать сколько угодно раз — ничего не сломается и
-- данные не пропадут. Старые заявки остаются как есть.
--
-- Куда вставлять: Supabase → SQL Editor → New query → вставить
-- весь файл → Run. Запускать ДО вливания изменений на сайт.
-- (Сначала должны быть выполнены supabase_plants.sql,
-- supabase_order_details.sql и supabase_unload_methods.sql — они уже
-- выполнены, если вы запускали VSE_ODNIM_FAILOM.sql.)
-- =====================================================================

-- ===== 1. Поля заявки АБН =====
alter table orders add column if not exists service_type text;
alter table orders add column if not exists pump_boom int;
alter table orders add column if not exists pump_hours numeric;
alter table orders add column if not exists pump_hours_actual numeric;
alter table orders add column if not exists pump_rate numeric;
alter table orders add column if not exists pump_prepaid boolean not null default false;
alter table orders add column if not exists pump_prepaid_confirmed boolean not null default false;
alter table orders add column if not exists pump_for_order_id uuid
  references orders(id) on delete set null;
alter table orders add column if not exists pump_hire_open boolean not null default false;
create index if not exists orders_pump_for_order_id_idx on orders (pump_for_order_id);
create index if not exists orders_service_type_idx on orders (service_type);

alter table orders drop constraint if exists orders_service_type_check;
alter table orders add constraint orders_service_type_check
  check (service_type is null or service_type in ('concrete', 'pump'));

-- Минимум 3 часа оплаты за АБН.
alter table orders drop constraint if exists orders_pump_hours_check;
alter table orders add constraint orders_pump_hours_check
  check (service_type is distinct from 'pump' or coalesce(pump_hours, 0) >= 3);

-- ===== 2. Насосник: длина стрелы своей машины =====
alter table app_users add column if not exists pump_boom int;

-- ===== 3. Парк завода: миксеристы И насосники =====
create or replace function app_users_plant_check()
returns trigger
language plpgsql as $$
begin
  if new.plant_id is not null then
    if new.plant_id = new.id then
      raise exception 'Аккаунт не может быть в парке сам у себя';
    end if;
    if new.account_type is null or new.account_type not in ('driver', 'pump') then
      raise exception 'В парк завода можно добавить только миксериста или насосника';
    end if;
    if not exists (
      select 1 from app_users where id = new.plant_id and account_type = 'plant'
    ) then
      raise exception 'Миксериста можно добавить только в парк завода';
    end if;
  end if;
  if new.plant_request_id is not null then
    if new.account_type is null or new.account_type not in ('driver', 'pump') then
      raise exception 'В парк завода можно добавить только миксериста или насосника';
    end if;
    if not exists (
      select 1 from app_users where id = new.plant_request_id and account_type = 'plant'
    ) then
      raise exception 'Запрос в парк можно отправить только от завода';
    end if;
  end if;
  return new;
end $$;

-- Заявка завода: исполнитель только из его парка. Исключение — заявка
-- АБН, которую завод открыл для найма насосника на сайте.
create or replace function orders_plant_check()
returns trigger
language plpgsql as $$
declare
  v_driver_plant uuid;
begin
  if new.plant_id is not null and new.driver_id is not null
     and not coalesce(new.pump_hire_open, false) and (
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

-- ===== 4. Чат «завод ↔ свой исполнитель» =====
alter table order_messages add column if not exists channel text;
alter table order_messages drop constraint if exists order_messages_channel_check;
alter table order_messages add constraint order_messages_channel_check
  check (channel is null or channel in ('plant', 'fleet'));

-- ===== 5. Цены АБН (за час, по длине стрелы) =====
-- Пока нули: «цена уточняется». Админ меняет на странице
-- «Партнёры» → «АБН».
alter table app_settings add column if not exists pump_rates jsonb not null
  default '{"24":0,"28":0,"32":0,"36":0,"42":0,"47":0,"52":0}'::jsonb;

-- Обновить кэш схемы, чтобы сайт сразу увидел новые колонки.
notify pgrst, 'reload schema';

-- Проверка: должна показать 1 строку с ценами АБН.
select pump_rates from app_settings where id = 1;
