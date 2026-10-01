-- ============================================================
-- PROBETON: подробная заявка, несколько миксеров, таймер простоя
--
-- Что делает этот файл:
--  1. Новые поля заявки:
--     - unload_method: как выгружают бетон — 'slide' (слив на
--       землю) или 'pump' (в автобетононасос). Обязательно в форме.
--     - chute_needed / chute_meters: нужен ли лоток (удлинитель)
--       и примерно сколько метров.
--     - may_reorder: клиент не уверен, что кубов хватит, и
--       возможно закажет ещё («дозаказ»). reorder_of — ссылка на
--       заявку, к которой сделан дозаказ.
--     - with_documents: бетон с документами (договор, накладные).
--       Такую заявку видят и выполняют только заводы.
--     - site_photo_url / access_confirmed: фото заезда на объект
--       или отметка клиента «заезд свободный, обеспечу проезд».
--  2. Несколько миксеров на один объект: завод выбирает из своего
--     парка несколько миксеристов и делит кубы между ними. Каждая
--     машина — отдельный рейс (своя строка в orders со ссылкой
--     parent_order_id на исходную заявку, «Машина 2 из 3»). У
--     каждого рейса свой чат, карта, оплата и таймер простоя.
--  3. Таймер простоя: миксерист нажимает «Я на объекте» и
--     «Выгрузка закончена», время берётся с сервера (не с телефона).
--     Первый час бесплатно, дальше клиент платит миксеристу за
--     каждый начатый час. Цену часа и бесплатное время админ
--     меняет на Главной (как цену публикации остатка).
--  4. Хранилище фото заезда (бакет order-photos).
--
-- Запускайте ПОСЛЕ supabase_balance.sql и supabase_plants.sql
-- (нужны таблица app_settings и колонки заводов).
-- Файл можно запускать повторно.
-- Вставьте целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

-- ===== 1. Колонки заявки =====

alter table orders add column if not exists unload_method text;
alter table orders add column if not exists chute_needed boolean not null default false;
alter table orders add column if not exists chute_meters numeric;
alter table orders add column if not exists may_reorder boolean not null default false;
alter table orders add column if not exists reorder_of uuid references orders(id) on delete set null;
alter table orders add column if not exists with_documents boolean not null default false;
alter table orders add column if not exists site_photo_url text;
alter table orders add column if not exists access_confirmed boolean not null default false;

-- Рейсы (несколько миксеров на одну заявку)
alter table orders add column if not exists parent_order_id uuid references orders(id) on delete set null;
alter table orders add column if not exists trip_no int;
alter table orders add column if not exists trips_total int;

-- Таймер простоя
alter table orders add column if not exists arrived_at timestamptz;
alter table orders add column if not exists unloaded_at timestamptz;
alter table orders add column if not exists downtime_free_minutes int;
alter table orders add column if not exists downtime_rate numeric;
alter table orders add column if not exists downtime_hours int not null default 0;
alter table orders add column if not exists downtime_fee numeric not null default 0;
alter table orders add column if not exists downtime_client_paid boolean not null default false;
alter table orders add column if not exists downtime_paid_confirmed boolean not null default false;

do $$ begin
  alter table orders add constraint orders_unload_method_check
    check (unload_method is null or unload_method in ('slide', 'pump'));
exception when duplicate_object then null; end $$;

create index if not exists orders_parent_order_id_idx on orders (parent_order_id);

-- Настройки простоя (админ меняет на Главной)
alter table app_settings add column if not exists downtime_hour_fee numeric not null default 7000;
alter table app_settings add column if not exists downtime_free_minutes int not null default 60;

-- ===== 2. Заявка с документами — только через завод =====

create or replace function orders_documents_check()
returns trigger
language plpgsql as $$
begin
  if new.with_documents and new.driver_id is not null and new.plant_id is null then
    raise exception 'Заявку «с документами» выполняет только завод — миксерист не может взять её напрямую';
  end if;
  return new;
end $$;

drop trigger if exists orders_documents_check on orders;
create trigger orders_documents_check
  before insert or update of driver_id, plant_id, with_documents on orders
  for each row execute function orders_documents_check();

-- ===== 3. Завод выделяет несколько миксеров на одну заявку =====
--
-- p_items — список вида [{"driver_id": "...", "cubes": 8}, ...].
-- Первый миксерист получает саму заявку, остальные — новые рейсы.
-- Сумма кубов должна совпасть с объёмом заявки.

create or replace function assign_order_mixers(
  p_plant_id uuid,
  p_order_id uuid,
  p_items jsonb
)
returns setof orders
language plpgsql security definer set search_path = public as $$
declare
  v_plant app_users;
  v_order orders;
  v_count int;
  v_sum numeric;
  v_item jsonb;
  v_driver app_users;
  v_cubes numeric;
  v_no int := 0;
  v_total_cubes numeric;
  v_name text;
  v_ids uuid[] := '{}';
  v_new_id uuid;
begin
  select * into v_plant from app_users where id = p_plant_id;
  if not found or v_plant.account_type is distinct from 'plant' then
    raise exception 'Только завод может выделять миксеры';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.plant_id is distinct from p_plant_id then
    raise exception 'Заявка не передана вашему заводу';
  end if;
  if coalesce(v_order.status, 'new') <> 'new' or v_order.driver_id is not null then
    raise exception 'На заявку уже выделен миксер';
  end if;

  v_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  if v_count < 1 or v_count > 20 then
    raise exception 'Выберите от 1 до 20 миксеров';
  end if;

  select sum((x->>'cubes')::numeric), count(distinct x->>'driver_id')
    into v_sum, v_no
    from jsonb_array_elements(p_items) x;
  if v_no <> v_count then
    raise exception 'Один миксерист выбран дважды';
  end if;
  v_total_cubes := coalesce(v_order.cubes, 0);
  if abs(coalesce(v_sum, 0) - v_total_cubes) > 0.01 then
    raise exception 'Сумма кубов по машинам (%) не равна объёму заявки (%)', v_sum, v_total_cubes;
  end if;

  v_no := 0;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_no := v_no + 1;
    v_cubes := (v_item->>'cubes')::numeric;
    if v_cubes is null or v_cubes <= 0 then
      raise exception 'У каждой машины должен быть объём больше 0';
    end if;

    select * into v_driver from app_users where id::text = v_item->>'driver_id';
    if not found or v_driver.plant_id is distinct from p_plant_id
       or v_driver.approval_status is distinct from 'approved' then
      raise exception 'Миксерист не из вашего парка или не одобрен';
    end if;
    if exists (
      select 1 from orders
      where driver_id = v_driver.id::text
        and coalesce(status, 'new') not in ('done', 'cancelled')
    ) then
      raise exception 'Миксерист % занят другим заказом',
        coalesce(v_driver.full_name, v_driver.driver_name, v_driver.phone);
    end if;

    v_name := coalesce(v_driver.full_name, v_driver.driver_name, 'Водитель');

    if v_count = 1 then
      update orders
      set driver_id = v_driver.id::text,
          driver_name = v_name,
          status = 'in_progress',
          accepted_at = now()
      where id = v_order.id;
      v_ids := v_ids || v_order.id;
    elsif v_no = 1 then
      update orders
      set driver_id = v_driver.id::text,
          driver_name = v_name,
          status = 'in_progress',
          accepted_at = now(),
          cubes = v_cubes,
          total = case when price_per_cube is not null then price_per_cube * v_cubes else null end,
          trip_no = 1,
          trips_total = v_count,
          what_needed = v_cubes || ' м³ бетона ' || coalesce(v_order.grade, '') ||
            ' (машина 1 из ' || v_count || ', всего по заявке ' || v_total_cubes || ' м³)' ||
            coalesce(', адрес: ' || v_order.delivery_address, '')
      where id = v_order.id;
      v_ids := v_ids || v_order.id;
    else
      insert into orders (
        order_number, what_needed, phone, order_type, grade, price_per_cube,
        cubes, total, delivery_address, delivery_lat, delivery_lng, comment,
        needed_by, status, driver_id, driver_name, accepted_at,
        plant_id, plant_name,
        unload_method, chute_needed, chute_meters, may_reorder, reorder_of,
        with_documents, site_photo_url, access_confirmed,
        parent_order_id, trip_no, trips_total
      ) values (
        coalesce(v_order.order_number, 'PB') || '-' || v_no,
        v_cubes || ' м³ бетона ' || coalesce(v_order.grade, '') ||
          ' (машина ' || v_no || ' из ' || v_count || ', всего по заявке ' || v_total_cubes || ' м³)' ||
          coalesce(', адрес: ' || v_order.delivery_address, ''),
        v_order.phone, coalesce(v_order.order_type, 'quick'), v_order.grade, v_order.price_per_cube,
        v_cubes,
        case when v_order.price_per_cube is not null then v_order.price_per_cube * v_cubes else null end,
        v_order.delivery_address, v_order.delivery_lat, v_order.delivery_lng, v_order.comment,
        v_order.needed_by, 'in_progress', v_driver.id::text, v_name, now(),
        v_order.plant_id, v_order.plant_name,
        v_order.unload_method, v_order.chute_needed, v_order.chute_meters,
        v_order.may_reorder, v_order.reorder_of,
        v_order.with_documents, v_order.site_photo_url, v_order.access_confirmed,
        v_order.id, v_no, v_count
      )
      returning id into v_new_id;
      v_ids := v_ids || v_new_id;
    end if;
  end loop;

  return query select * from orders where id = any(v_ids) order by trip_no nulls first;
end;
$$;

-- ===== 4. Таймер простоя =====

create or replace function mark_arrived(p_driver_id uuid, p_order_id uuid)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_rate numeric;
  v_free int;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.driver_id is distinct from p_driver_id::text then
    raise exception 'Это не ваш заказ';
  end if;
  if coalesce(v_order.status, 'new') in ('done', 'cancelled') then
    raise exception 'Заказ уже закрыт';
  end if;
  if v_order.arrived_at is not null then
    return v_order;
  end if;

  select downtime_hour_fee, downtime_free_minutes into v_rate, v_free
    from app_settings where id = 1;

  update orders
  set arrived_at = now(),
      downtime_rate = coalesce(v_rate, 0),
      downtime_free_minutes = coalesce(v_free, 60)
  where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function finish_unloading(p_driver_id uuid, p_order_id uuid)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_extra numeric;
  v_hours int;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.driver_id is distinct from p_driver_id::text then
    raise exception 'Это не ваш заказ';
  end if;
  if v_order.arrived_at is null then
    raise exception 'Сначала нажмите «Я на объекте»';
  end if;
  if v_order.unloaded_at is not null then
    return v_order;
  end if;

  -- Минуты сверх бесплатного времени -> каждый начатый час платный.
  v_extra := extract(epoch from (now() - v_order.arrived_at)) / 60
             - coalesce(v_order.downtime_free_minutes, 60);
  v_hours := case when v_extra > 0 then ceil(v_extra / 60)::int else 0 end;

  update orders
  set unloaded_at = now(),
      downtime_hours = v_hours,
      downtime_fee = v_hours * coalesce(downtime_rate, 0)
  where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$$;

grant execute on function assign_order_mixers(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function mark_arrived(uuid, uuid) to anon, authenticated;
grant execute on function finish_unloading(uuid, uuid) to anon, authenticated;

-- ===== 5. Фото заезда (публичное, как фото водителей) =====

insert into storage.buckets (id, name, public)
values ('order-photos', 'order-photos', true)
on conflict (id) do nothing;

drop policy if exists "order_photos_select" on storage.objects;
drop policy if exists "order_photos_insert" on storage.objects;
create policy "order_photos_select" on storage.objects for select using (bucket_id = 'order-photos');
create policy "order_photos_insert" on storage.objects for insert with check (bucket_id = 'order-photos');

-- Обновить кэш схемы, чтобы сайт сразу увидел новые колонки.
notify pgrst, 'reload schema';

-- ===== Проверьте после запуска: =====
-- Table Editor -> orders: есть колонки unload_method, with_documents,
--   arrived_at, downtime_fee, parent_order_id
-- Table Editor -> app_settings: есть downtime_hour_fee (7000) и
--   downtime_free_minutes (60)
-- Storage -> Buckets: есть бакет "order-photos"
