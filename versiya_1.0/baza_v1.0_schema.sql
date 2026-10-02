-- PROBETON / Кубовик — снимок структуры базы Supabase, версия 1.0
-- Снято 2026-10-02 с живой базы (проект zlbsnnikgfhxplmsaqlg), только чтение.
-- Код сайта этой версии: ветка release/v1.0 (коммит 519d5fe3) в github.com/miraskths2-afk/Beton
-- Здесь только структура (таблицы, ограничения, индексы, функции, триггеры, политики), без данных.

create table if not exists public.app_settings (
  id integer default 1 not null,
  leftover_post_fee numeric default 1000 not null,
  kaspi_details text default 'Kaspi Gold PROBETON: +7 ___ ___ __ __'::text not null,
  updated_at timestamp with time zone default now() not null,
  downtime_hour_fee numeric default 7000 not null,
  downtime_free_minutes integer default 60 not null,
  pump_rates jsonb default '{"1": 50000, "24": 40000, "28": 40000, "32": 40000, "37": 40000, "42": 45000, "47": 50000, "52": 55000, "56": 60000, "62": 65000, "65": 70000}'::jsonb not null,
  pump_fee_per_hour numeric default 1000 not null
);

create table if not exists public.app_users (
  id uuid default gen_random_uuid() not null,
  created_date timestamp with time zone default now() not null,
  phone text not null,
  role text default 'user'::text not null,
  account_type text,
  driver_name text,
  vehicle_plate text,
  equipment_type text,
  approval_status text default 'pending'::text not null,
  full_name text,
  terms_accepted boolean default false not null,
  terms_version text,
  notifications_enabled boolean default true not null,
  photo_url text,
  balance numeric default 0 not null,
  plant_id uuid,
  plant_request_id uuid,
  plant_address text,
  plant_lat double precision,
  plant_lng double precision,
  plant_active boolean default true not null,
  pump_boom integer,
  warnings integer default 0 not null
);

create table if not exists public.balance_topups (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  amount numeric not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  confirmed_at timestamp with time zone
);

create table if not exists public.balance_transactions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  amount numeric not null,
  kind text not null,
  ref_id uuid,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.blacklist (
  id uuid default gen_random_uuid() not null,
  created_date timestamp with time zone default now() not null,
  phone text not null,
  reason text
);

create table if not exists public.complaints (
  id uuid default gen_random_uuid() not null,
  created_date timestamp with time zone default now() not null,
  order_id uuid,
  from_user_id uuid,
  from_name text,
  against_phone text not null,
  reason text,
  status text default 'open'::text not null,
  resolved_at timestamp with time zone
);

create table if not exists public.driver_locations (
  driver_id uuid not null,
  driver_name text,
  lat double precision not null,
  lng double precision not null,
  is_online boolean default true not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.leftovers (
  id uuid default gen_random_uuid() not null,
  created_date timestamp with time zone default now() not null,
  grade text,
  cubes numeric,
  direction text,
  price numeric,
  driver_id text,
  driver_name text,
  phone text,
  status text default 'available'::text not null,
  intercepted_by_phone text,
  expires_at timestamp with time zone,
  intercepted_lat double precision,
  intercepted_lng double precision,
  intercepted_at timestamp with time zone,
  completed_at timestamp with time zone
);

create table if not exists public.order_messages (
  id uuid default gen_random_uuid() not null,
  order_id uuid,
  sender_role text not null,
  sender_name text,
  message text not null,
  created_at timestamp with time zone default now() not null,
  leftover_id uuid,
  sender_id uuid,
  read_at timestamp with time zone,
  audio_url text,
  audio_duration numeric,
  channel text
);

create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  created_date timestamp with time zone default now() not null,
  order_number text,
  what_needed text not null,
  phone text not null,
  order_type text default 'quick'::text not null,
  grade text,
  price_per_cube numeric,
  cubes numeric,
  total numeric,
  delivery_address text,
  mixer_time text,
  status text default 'new'::text not null,
  driver_id text,
  driver_name text,
  client_paid boolean default false not null,
  commission_paid boolean default false not null,
  client_rating numeric,
  driver_rating numeric,
  comment text,
  driver_paid boolean default false not null,
  driver_payment_confirmed boolean default false not null,
  needed_by timestamp with time zone,
  delivery_lat double precision,
  delivery_lng double precision,
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  hidden_from_history boolean default false not null,
  recurring_id uuid,
  recurring_date date,
  plant_id uuid,
  plant_name text,
  unload_method text,
  chute_needed boolean default false not null,
  chute_meters numeric,
  may_reorder boolean default false not null,
  reorder_of uuid,
  with_documents boolean default false not null,
  site_photo_url text,
  access_confirmed boolean default false not null,
  parent_order_id uuid,
  trip_no integer,
  trips_total integer,
  arrived_at timestamp with time zone,
  unloaded_at timestamp with time zone,
  downtime_free_minutes integer,
  downtime_rate numeric,
  downtime_hours integer default 0 not null,
  downtime_fee numeric default 0 not null,
  downtime_client_paid boolean default false not null,
  downtime_paid_confirmed boolean default false not null,
  service_type text,
  pump_boom integer,
  pump_hours numeric,
  pump_hours_actual numeric,
  pump_rate numeric,
  pump_prepaid boolean default false not null,
  pump_prepaid_confirmed boolean default false not null,
  pump_for_order_id uuid,
  pump_hire_open boolean default false not null,
  pump_fee_rate numeric,
  pump_service_fee numeric,
  cancelled_by text,
  cancel_requested_at timestamp with time zone,
  cancel_request_reason text
);

create table if not exists public.recurring_orders (
  id uuid default gen_random_uuid() not null,
  created_date timestamp with time zone default now() not null,
  phone text not null,
  client_name text,
  grade text,
  cubes numeric not null,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  comment text,
  weekdays integer[] default '{}'::integer[] not null,
  delivery_time text default '09:00'::text not null,
  active boolean default true not null,
  created_by text
);

-- ===== Ограничения =====
alter table app_settings add constraint app_settings_id_check CHECK ((id = 1));
alter table app_settings add constraint app_settings_pkey PRIMARY KEY (id);
alter table app_users add constraint app_users_phone_key UNIQUE (phone);
alter table app_users add constraint app_users_pkey PRIMARY KEY (id);
alter table app_users add constraint app_users_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES app_users(id) ON DELETE SET NULL;
alter table app_users add constraint app_users_plant_request_id_fkey FOREIGN KEY (plant_request_id) REFERENCES app_users(id) ON DELETE SET NULL;
alter table balance_topups add constraint balance_topups_amount_check CHECK (((amount >= (500)::numeric) AND (amount <= (500000)::numeric)));
alter table balance_topups add constraint balance_topups_pkey PRIMARY KEY (id);
alter table balance_topups add constraint balance_topups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table balance_topups add constraint balance_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
alter table balance_transactions add constraint balance_transactions_pkey PRIMARY KEY (id);
alter table balance_transactions add constraint balance_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
alter table blacklist add constraint blacklist_pkey PRIMARY KEY (id);
alter table complaints add constraint complaints_pkey PRIMARY KEY (id);
alter table complaints add constraint complaints_status_check CHECK ((status = ANY (ARRAY['open'::text, 'accepted'::text, 'rejected'::text])));
alter table driver_locations add constraint driver_locations_pkey PRIMARY KEY (driver_id);
alter table leftovers add constraint leftovers_pkey PRIMARY KEY (id);
alter table order_messages add constraint order_messages_channel_check CHECK (((channel IS NULL) OR (channel = ANY (ARRAY['plant'::text, 'fleet'::text]))));
alter table order_messages add constraint order_messages_one_chat CHECK (((order_id IS NOT NULL) OR (leftover_id IS NOT NULL)));
alter table order_messages add constraint order_messages_pkey PRIMARY KEY (id);
alter table orders add constraint orders_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table orders add constraint orders_pkey PRIMARY KEY (id);
alter table orders add constraint orders_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES app_users(id) ON DELETE SET NULL;
alter table orders add constraint orders_pump_for_order_id_fkey FOREIGN KEY (pump_for_order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table orders add constraint orders_pump_hours_check CHECK (((service_type IS DISTINCT FROM 'pump'::text) OR (COALESCE(pump_hours, (0)::numeric) >= (3)::numeric)));
alter table orders add constraint orders_reorder_of_fkey FOREIGN KEY (reorder_of) REFERENCES orders(id) ON DELETE SET NULL;
alter table orders add constraint orders_service_type_check CHECK (((service_type IS NULL) OR (service_type = ANY (ARRAY['concrete'::text, 'pump'::text]))));
alter table orders add constraint orders_unload_method_check CHECK (((unload_method IS NULL) OR (unload_method = ANY (ARRAY['slide'::text, 'pump'::text, 'crane'::text, 'conveyor'::text, 'mixer_pump'::text, 'line_pump'::text, 'wheelbarrow'::text]))));
alter table recurring_orders add constraint recurring_orders_pkey PRIMARY KEY (id);

-- ===== Индексы =====
CREATE INDEX app_users_plant_id_idx ON public.app_users USING btree (plant_id);
CREATE INDEX app_users_plant_request_id_idx ON public.app_users USING btree (plant_request_id);
CREATE INDEX order_messages_created_idx ON public.order_messages USING btree (created_at DESC);
CREATE INDEX order_messages_leftover_idx ON public.order_messages USING btree (leftover_id, created_at);
CREATE INDEX order_messages_order_channel_idx ON public.order_messages USING btree (order_id, channel);
CREATE INDEX order_messages_order_idx ON public.order_messages USING btree (order_id, created_at);
CREATE INDEX orders_parent_order_id_idx ON public.orders USING btree (parent_order_id);
CREATE INDEX orders_plant_id_idx ON public.orders USING btree (plant_id);
CREATE INDEX orders_pump_for_order_id_idx ON public.orders USING btree (pump_for_order_id);
CREATE INDEX orders_service_type_idx ON public.orders USING btree (service_type);

-- ===== Функции =====
CREATE OR REPLACE FUNCTION public.add_warning(p_user_id uuid, p_reason text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  v_count int;
  v_phone text;
begin
  update app_users
     set warnings = coalesce(warnings, 0) + 1
   where id = p_user_id and role <> 'admin'
  returning warnings, phone into v_count, v_phone;
  if v_count is null then
    return 0;
  end if;
  if v_count >= 3 and not exists (
    select 1 from blacklist
     where right(regexp_replace(phone, '\D', '', 'g'), 10) =
           right(regexp_replace(v_phone, '\D', '', 'g'), 10)
  ) then
    insert into blacklist (phone, reason)
    values (v_phone, '3 предупреждения: ' || coalesce(p_reason, ''));
  end if;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_users_plant_check()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.app_users_plant_released()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.account_type = 'plant' and new.account_type is distinct from 'plant' then
    update app_users set plant_id = null where plant_id = new.id;
    update app_users set plant_request_id = null where plant_request_id = new.id;
    update orders set plant_id = null, plant_name = null
      where plant_id = new.id and driver_id is null and status = 'new';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.assign_order_mixers(p_plant_id uuid, p_order_id uuid, p_items jsonb)
 RETURNS SETOF orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.block_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'Изменение роли через сайт запрещено. Меняйте role только через Supabase.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_unloading(p_driver_id uuid, p_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_recurring_orders()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  r recurring_orders%rowtype;
  local_now timestamp := now() at time zone 'Asia/Almaty';
  d date;
  delivery_at timestamptz;
  created_count integer := 0;
  new_id uuid;
begin
  for r in select * from recurring_orders where active loop
    -- Смотрим сегодня и завтра (по Алматы).
    for i in 0..1 loop
      d := (local_now::date + i);
      continue when not (extract(isodow from d)::int = any (r.weekdays));

      delivery_at := ((d + coalesce(nullif(r.delivery_time, ''), '09:00')::time)
                      at time zone 'Asia/Almaty');

      -- Создаём заявку за сутки до подачи и не позже самого времени подачи.
      continue when now() < delivery_at - interval '24 hours';
      continue when now() >= delivery_at;

      -- Номер в чёрном списке — заявку не создаём.
      continue when exists (
        select 1 from blacklist b
        where right(regexp_replace(b.phone, '\D', '', 'g'), 10)
            = right(regexp_replace(r.phone, '\D', '', 'g'), 10)
      );

      insert into orders (
        order_number, what_needed, phone, order_type, grade, cubes,
        delivery_address, delivery_lat, delivery_lng, comment, status,
        needed_by, recurring_id, recurring_date
      ) values (
        'PB-' || right(((extract(epoch from clock_timestamp()) * 1000)::bigint)::text, 6),
        r.cubes || ' м³ бетона ' || coalesce(r.grade, '') ||
          coalesce(', адрес: ' || r.delivery_address, ''),
        r.phone, 'recurring', r.grade, r.cubes,
        r.delivery_address, r.delivery_lat, r.delivery_lng,
        r.comment, 'new', delivery_at, r.id, d
      )
      on conflict do nothing
      returning id into new_id;

      if new_id is not null then
        created_count := created_count + 1;
        new_id := null;
      end if;
    end loop;
  end loop;
  return created_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_arrived(p_driver_id uuid, p_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.orders_documents_check()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.with_documents and new.driver_id is not null and new.plant_id is null then
    raise exception 'Заявку «с документами» выполняет только завод — миксерист не может взять её напрямую';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.orders_plant_check()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.publish_leftover(p_user_id uuid, p_grade text, p_cubes numeric, p_direction text, p_price numeric, p_phone text, p_minutes integer)
 RETURNS leftovers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.pump_finish(p_driver_id uuid, p_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order orders;
  v_worked int;
  v_billed int;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.driver_id is distinct from p_driver_id::text then
    raise exception 'Это не ваш заказ';
  end if;
  if v_order.arrived_at is null then
    raise exception 'Сначала нажмите «Насос встал на лапы»';
  end if;
  if v_order.unloaded_at is not null then
    return v_order;
  end if;
  v_worked := ceil(extract(epoch from (now() - v_order.arrived_at)) / 3600)::int;
  v_billed := greatest(3, coalesce(v_order.pump_hours, 0), v_worked);
  update orders
  set unloaded_at = now(),
      pump_hours_actual = v_billed,
      pump_service_fee = v_billed * coalesce(pump_fee_rate, 1000)
  where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pump_start(p_driver_id uuid, p_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order orders;
  v_fee numeric;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.driver_id is distinct from p_driver_id::text then
    raise exception 'Это не ваш заказ';
  end if;
  if v_order.service_type is distinct from 'pump' then
    raise exception 'Это не заявка на АБН';
  end if;
  if coalesce(v_order.status, 'new') in ('done', 'cancelled') then
    raise exception 'Заказ уже закрыт';
  end if;
  if v_order.arrived_at is not null then
    return v_order;
  end if;
  select pump_fee_per_hour into v_fee from app_settings where id = 1;
  update orders
  set arrived_at = now(),
      pump_fee_rate = coalesce(v_fee, 1000)
  where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_topup(p_user_id uuid, p_amount numeric)
 RETURNS balance_topups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reset_warnings_on_unblacklist()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  update app_users
     set warnings = 0
   where right(regexp_replace(phone, '\D', '', 'g'), 10) =
         right(regexp_replace(old.phone, '\D', '', 'g'), 10);
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_topup(p_admin_id uuid, p_id uuid, p_approve boolean)
 RETURNS balance_topups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ===== Триггеры =====
CREATE TRIGGER app_users_plant_check BEFORE INSERT OR UPDATE OF plant_id, plant_request_id, account_type ON public.app_users FOR EACH ROW EXECUTE FUNCTION app_users_plant_check();
CREATE TRIGGER app_users_plant_released AFTER UPDATE OF account_type ON public.app_users FOR EACH ROW EXECUTE FUNCTION app_users_plant_released();
CREATE TRIGGER blacklist_reset_warnings AFTER DELETE ON public.blacklist FOR EACH ROW EXECUTE FUNCTION reset_warnings_on_unblacklist();
CREATE TRIGGER orders_documents_check BEFORE INSERT OR UPDATE OF driver_id, plant_id, with_documents ON public.orders FOR EACH ROW EXECUTE FUNCTION orders_documents_check();
CREATE TRIGGER orders_plant_check BEFORE INSERT OR UPDATE OF plant_id, driver_id ON public.orders FOR EACH ROW EXECUTE FUNCTION orders_plant_check();
CREATE TRIGGER trg_block_role_escalation BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION block_role_escalation();

-- ===== Политики доступа (RLS) =====
alter table public.app_settings enable row level security;
create policy app_settings_select on public.app_settings for SELECT to public using (true);
create policy app_settings_update on public.app_settings for UPDATE to public using (true) with check (true);
alter table public.app_users enable row level security;
create policy app_users_delete on public.app_users for DELETE to public using ((role <> 'admin'::text));
create policy app_users_insert on public.app_users for INSERT to public with check (true);
create policy app_users_select on public.app_users for SELECT to public using (true);
create policy app_users_update on public.app_users for UPDATE to public using (true) with check (true);
alter table public.balance_topups enable row level security;
create policy balance_topups_select on public.balance_topups for SELECT to public using (true);
alter table public.balance_transactions enable row level security;
create policy balance_transactions_select on public.balance_transactions for SELECT to public using (true);
alter table public.blacklist enable row level security;
create policy blacklist_all on public.blacklist for ALL to public using (true) with check (true);
alter table public.complaints enable row level security;
create policy complaints_all on public.complaints for ALL to public using (true) with check (true);
alter table public.driver_locations enable row level security;
create policy driver_locations_delete on public.driver_locations for DELETE to public using (true);
create policy driver_locations_insert on public.driver_locations for INSERT to public with check (true);
create policy driver_locations_select on public.driver_locations for SELECT to public using (true);
create policy driver_locations_update on public.driver_locations for UPDATE to public using (true) with check (true);
alter table public.leftovers enable row level security;
create policy leftovers_delete on public.leftovers for DELETE to public using (true);
create policy leftovers_insert on public.leftovers for INSERT to public with check (true);
create policy leftovers_select on public.leftovers for SELECT to public using (true);
create policy leftovers_update on public.leftovers for UPDATE to public using (true) with check (true);
alter table public.order_messages enable row level security;
create policy order_messages_all on public.order_messages for ALL to public using (true) with check (true);
alter table public.orders enable row level security;
create policy orders_all on public.orders for ALL to public using (true) with check (true);
alter table public.recurring_orders enable row level security;
create policy recurring_orders_all on public.recurring_orders for ALL to public using (true) with check (true);
