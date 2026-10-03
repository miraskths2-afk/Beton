-- ============================================================
-- Уведомления на телефон (Web Push) — версия 2.0
-- ============================================================
-- Что делает этот файл:
--   1. Таблица push_subscriptions — «адреса» телефонов, куда слать
--      уведомления (одна строка = одно устройство одного пользователя).
--   2. Таблица push_config — ключи и секрет для отправки. Закрыта от
--      сайта: читают её только сама база и функция отправки.
--   3. orders.eta_notified_at — когда заказчику сообщили «машина будет
--      через ~15 минут» (чтобы не повторять).
--      orders.self_accepted — водитель взял заказ сам из ленты (тогда
--      «вам назначен заказ» ему не шлём).
--   4. push_notify(...) — ставит уведомление в очередь: база сама
--      вызывает функцию отправки (Supabase Edge Function "push") через
--      расширение pg_net. Ошибка отправки НИКОГДА не ломает сам заказ.
--   5. Триггеры: какие события в базе превращаются в уведомления.
--
-- Ключи (VAPID) и адрес функции в push_config вносятся отдельно, один
-- раз, при включении — в этом файле их нет специально.
-- Файл можно запускать повторно.
-- ============================================================

create extension if not exists pg_net;

-- ===== 1. Подписки устройств =====
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lang text not null default 'ru',
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;
drop policy if exists "push_subscriptions open" on push_subscriptions;
create policy "push_subscriptions open" on push_subscriptions
  for all using (true) with check (true);
grant select, insert, update, delete on push_subscriptions to anon, authenticated;

-- ===== 2. Настройки отправки (закрыты от сайта) =====
create table if not exists push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text,
  vapid_private text,
  vapid_subject text default 'mailto:admin@probeton.kz',
  function_url text,
  secret text default encode(gen_random_bytes(24), 'hex')
);
insert into push_config (id) values (1) on conflict (id) do nothing;
alter table push_config enable row level security;
revoke all on push_config from anon, authenticated;

-- Публичный ключ нужен браузеру, чтобы подписаться. Он не секретный.
create or replace function push_public_key()
returns text
language sql security definer set search_path = public as $$
  select vapid_public from push_config where id = 1;
$$;
grant execute on function push_public_key() to anon, authenticated;

-- ===== 3. Новые поля заказа =====
alter table orders add column if not exists eta_notified_at timestamptz;
alter table orders add column if not exists self_accepted boolean;

-- ===== 4. Постановка уведомления в очередь =====
-- p_key — какое сообщение (тексты на русском и казахском лежат в
-- функции отправки), p_params — подстановки, p_url — что открыть по
-- нажатию, p_tag — одинаковый tag заменяет предыдущее уведомление.
create or replace function push_notify(
  p_users uuid[],
  p_key text,
  p_params jsonb default '{}'::jsonb,
  p_url text default '/',
  p_tag text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cfg push_config;
  v_users uuid[];
begin
  select * into v_cfg from push_config where id = 1;
  if v_cfg.function_url is null or v_cfg.vapid_private is null then
    return; -- уведомления ещё не включены
  end if;

  -- Только те, у кого уведомления не выключены в профиле и есть
  -- хотя бы одно подписанное устройство.
  select array_agg(distinct u.id) into v_users
  from app_users u
  where u.id = any(p_users)
    and u.notifications_enabled is distinct from false
    and exists (select 1 from push_subscriptions s where s.user_id = u.id);
  if v_users is null then
    return;
  end if;

  perform net.http_post(
    url := v_cfg.function_url,
    body := jsonb_build_object(
      'users', to_jsonb(v_users),
      'key', p_key,
      'params', coalesce(p_params, '{}'::jsonb),
      'url', coalesce(p_url, '/'),
      'tag', p_tag
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_cfg.secret
    ),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'push_notify: %', sqlerrm;
end;
$$;
revoke all on function push_notify(uuid[], text, jsonb, text, text) from public, anon, authenticated;

-- Вспомогательные выборки получателей.
create or replace function push_admins()
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from app_users where role = 'admin';
$$;

-- Аккаунты заказчика по номеру телефона (сравниваем последние 10 цифр:
-- в базе номера записаны в разных форматах).
create or replace function push_users_by_phone(p_phone text)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from app_users
  where length(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)) = 10
    and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
        = right(regexp_replace(p_phone, '\D', '', 'g'), 10);
$$;

create or replace function push_user_by_text_id(p_id text)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from app_users where id::text = p_id;
$$;

-- Номера телефонов в тексте чата собеседнику не показываем.
create or replace function push_hide_phones(p_text text)
returns text
language sql immutable as $$
  select regexp_replace(coalesce(p_text, ''), '\+?\d[\d\s()\-]{8,}\d', '•••', 'g');
$$;

-- ===== 5. Триггеры =====

-- 5.1 Заказы
create or replace function push_orders_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_p jsonb;
  v_url text;
  v_tag text;
  v_client uuid[];
  v_driver uuid[];
  v_workers uuid[];
  v_pump boolean;
begin
  v_pump := new.service_type = 'pump';
  v_url := '/order/' || new.id;
  v_tag := 'order-' || coalesce(new.parent_order_id, new.id);
  v_p := jsonb_build_object(
    'n', coalesce(new.order_number, left(new.id::text, 6)),
    'grade', coalesce(new.grade, ''),
    'cubes', coalesce(new.cubes::text, ''),
    'address', coalesce(new.delivery_address, ''),
    'name', coalesce(new.driver_name, ''),
    'pump', v_pump,
    'hours', coalesce(new.pump_hours::text, '')
  );
  v_client := push_users_by_phone(new.phone);
  v_driver := push_user_by_text_id(new.driver_id);

  if tg_op = 'INSERT' then
    -- Новая свободная заявка: всем одобренным миксеристам (или
    -- насосникам — для заявки АБН), кроме чёрного списка. Рейсы одной
    -- заявки (2-я, 3-я машина) отдельно не объявляем.
    if new.driver_id is null and coalesce(new.status, 'new') = 'new'
       and new.parent_order_id is null then
      select coalesce(array_agg(u.id), '{}') into v_workers
      from app_users u
      where u.account_type = case when v_pump then 'pump' else 'driver' end
        and u.approval_status = 'approved'
        and not exists (
          select 1 from blacklist b
          where right(regexp_replace(coalesce(b.phone, ''), '\D', '', 'g'), 10)
              = right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10)
        );
      perform push_notify(v_workers, 'new_order', v_p, '/', 'new-' || new.id);
      perform push_notify(push_admins(), 'admin_new_order', v_p, v_url, 'new-' || new.id);
    end if;
    return new;
  end if;

  -- UPDATE
  -- Исполнитель появился или сменился.
  if new.driver_id is not null and new.driver_id is distinct from old.driver_id then
    perform push_notify(v_client, 'accepted', v_p, v_url, v_tag);
    -- Сам взял из ленты — ему сообщать не нужно; назначил диспетчер — нужно.
    if not (new.self_accepted is true and old.self_accepted is distinct from true) then
      perform push_notify(v_driver, 'assigned', v_p, v_url, v_tag);
    end if;
  end if;

  -- Заказ сняли с исполнителя (не отмена).
  if old.driver_id is not null and new.driver_id is distinct from old.driver_id
     and coalesce(new.status, '') <> 'cancelled' then
    perform push_notify(push_user_by_text_id(old.driver_id), 'unassigned', v_p, '/', v_tag);
  end if;

  if new.status = 'en_route' and old.status is distinct from 'en_route' then
    perform push_notify(v_client, 'en_route', v_p, v_url, v_tag);
  end if;

  if new.eta_notified_at is not null and old.eta_notified_at is null then
    perform push_notify(v_client, 'eta15', v_p, v_url, v_tag);
  end if;

  if new.arrived_at is not null and old.arrived_at is null then
    perform push_notify(v_client, 'arrived', v_p, v_url, v_tag);
  end if;

  if new.unloaded_at is not null and old.unloaded_at is null then
    perform push_notify(v_client, 'unloaded', v_p, v_url, v_tag);
  end if;

  if new.status = 'done' and old.status is distinct from 'done' and new.unloaded_at is null then
    perform push_notify(v_client, 'done', v_p, v_url, v_tag);
  end if;

  if new.client_paid is true and old.client_paid is not true then
    perform push_notify(push_admins(), 'admin_client_paid', v_p, v_url, 'pay-' || new.id);
  end if;

  if new.commission_paid is true and old.commission_paid is not true then
    perform push_notify(v_client, 'client_payment_confirmed', v_p, v_url, v_tag);
  end if;

  if new.driver_paid is true and old.driver_paid is not true then
    perform push_notify(push_admins(), 'admin_driver_paid', v_p, v_url, 'dpay-' || new.id);
  end if;

  if new.driver_payment_confirmed is true and old.driver_payment_confirmed is not true then
    perform push_notify(v_driver, 'driver_payment_confirmed', v_p, v_url, v_tag);
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform push_notify(v_driver, 'cancelled', v_p, '/', v_tag);
    if new.cancelled_by is distinct from 'client' then
      perform push_notify(v_client, 'cancelled', v_p, v_url, v_tag);
    end if;
  end if;

  if new.cancel_requested_at is not null and old.cancel_requested_at is null then
    perform push_notify(push_admins(), 'admin_cancel_request', v_p, v_url, 'cancel-' || new.id);
  end if;

  return new;
exception when others then
  raise warning 'push_orders_trigger: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_orders on orders;
create trigger push_orders after insert or update on orders
  for each row execute function push_orders_trigger();

-- 5.2 Баланс: заявки на пополнение
create or replace function push_topups_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_p jsonb;
begin
  select jsonb_build_object(
           'amount', to_char(new.amount, 'FM999G999G999'),
           'name', coalesce(u.full_name, u.driver_name, u.phone, ''))
    into v_p
  from app_users u where u.id = new.user_id;
  v_p := coalesce(v_p, jsonb_build_object('amount', new.amount::text, 'name', ''));

  if tg_op = 'INSERT' then
    perform push_notify(push_admins(), 'admin_topup_request', v_p, '/', 'topup-' || new.id);
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      perform push_notify(array[new.user_id], 'topup_confirmed', v_p, '/balance', 'topup-' || new.id);
    elsif new.status = 'rejected' then
      perform push_notify(array[new.user_id], 'topup_rejected', v_p, '/balance', 'topup-' || new.id);
    end if;
  end if;
  return new;
exception when others then
  raise warning 'push_topups_trigger: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_topups on balance_topups;
create trigger push_topups after insert or update on balance_topups
  for each row execute function push_topups_trigger();

-- 5.3 Баланс: списания и начисления (пополнение уже сообщили выше)
create or replace function push_transactions_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'topup' or coalesce(new.amount, 0) = 0 then
    return new;
  end if;
  perform push_notify(
    array[new.user_id],
    case when new.amount < 0 then 'balance_charge' else 'balance_credit' end,
    jsonb_build_object('amount', to_char(abs(new.amount), 'FM999G999G999'),
                       'note', coalesce(new.note, '')),
    '/balance',
    'tx-' || new.id
  );
  return new;
exception when others then
  raise warning 'push_transactions_trigger: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_transactions on balance_transactions;
create trigger push_transactions after insert on balance_transactions
  for each row execute function push_transactions_trigger();

-- 5.4 Пользователи: одобрение аккаунта, предупреждения, новые водители
create or replace function push_users_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(new.full_name, new.driver_name, new.phone, '');
begin
  if tg_op = 'INSERT' then
    if new.approval_status = 'pending' then
      perform push_notify(push_admins(), 'admin_new_user',
        jsonb_build_object('name', v_name), '/', 'user-' || new.id);
    end if;
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status then
    if new.approval_status = 'approved' then
      perform push_notify(array[new.id], 'account_approved', '{}'::jsonb, '/', 'account');
    elsif new.approval_status = 'rejected' then
      perform push_notify(array[new.id], 'account_rejected', '{}'::jsonb, '/', 'account');
    end if;
  end if;

  if coalesce(new.warnings, 0) > coalesce(old.warnings, 0) then
    perform push_notify(array[new.id], 'warning',
      jsonb_build_object('count', new.warnings::text), '/profile', 'warning');
  end if;
  return new;
exception when others then
  raise warning 'push_users_trigger: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_users on app_users;
create trigger push_users after insert or update on app_users
  for each row execute function push_users_trigger();

-- 5.5 Кубовик: остаток забрали
create or replace function push_leftovers_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'intercepted' and old.status is distinct from 'intercepted' then
    perform push_notify(
      push_user_by_text_id(new.driver_id),
      'leftover_taken',
      jsonb_build_object('grade', coalesce(new.grade, ''), 'cubes', coalesce(new.cubes::text, '')),
      '/leftover/' || new.id,
      'leftover-' || new.id
    );
  end if;
  return new;
exception when others then
  raise warning 'push_leftovers_trigger: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_leftovers on leftovers;
create trigger push_leftovers after update on leftovers
  for each row execute function push_leftovers_trigger();

-- 5.6 Чат: сообщение собеседнику
create or replace function push_messages_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_to uuid[] := '{}';
  v_driver uuid[] := '{}';
  v_client uuid[] := '{}';
  v_url text;
  v_text text;
  o orders;
  l leftovers;
begin
  if new.order_id is not null and new.channel is null then
    select * into o from orders where id = new.order_id;
    if not found then return new; end if;
    v_driver := push_user_by_text_id(o.driver_id);
    v_client := push_users_by_phone(o.phone);
    v_url := '/chat/order/' || o.id;
  elsif new.leftover_id is not null then
    select * into l from leftovers where id = new.leftover_id;
    if not found then return new; end if;
    v_driver := push_user_by_text_id(l.driver_id);
    v_client := push_users_by_phone(l.intercepted_by_phone);
    v_url := '/chat/leftover/' || l.id;
  else
    return new;
  end if;

  if new.sender_role = 'client' then
    v_to := v_driver;
  elsif new.sender_role = 'driver' then
    v_to := v_client;
  else
    v_to := v_driver || v_client;
  end if;
  if new.sender_id is not null then
    v_to := array_remove(v_to, new.sender_id);
  end if;

  v_text := case
    when new.audio_url is not null and coalesce(trim(new.message), '') = '' then '🎤'
    else left(push_hide_phones(new.message), 140)
  end;

  perform push_notify(v_to, 'chat_message',
    jsonb_build_object('name', coalesce(new.sender_name, ''),
                       'role', coalesce(new.sender_role, ''),
                       'text', v_text),
    v_url, 'chat-' || coalesce(new.order_id, new.leftover_id));
  return new;
exception when others then
  raise warning 'push_messages_trigger: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_messages on order_messages;
create trigger push_messages after insert on order_messages
  for each row execute function push_messages_trigger();

-- 5.7 Жалобы — диспетчеру
create or replace function push_complaints_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform push_notify(push_admins(), 'admin_complaint',
    jsonb_build_object('name', coalesce(new.from_name, ''),
                       'text', left(coalesce(new.reason, ''), 140)),
    case when new.order_id is not null then '/order/' || new.order_id else '/' end,
    'complaint-' || new.id);
  return new;
exception when others then
  raise warning 'push_complaints_trigger: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_complaints on complaints;
create trigger push_complaints after insert on complaints
  for each row execute function push_complaints_trigger();

-- Служебные функции сайту вызывать не нужно.
revoke all on function push_admins() from public, anon, authenticated;
revoke all on function push_users_by_phone(text) from public, anon, authenticated;
revoke all on function push_user_by_text_id(text) from public, anon, authenticated;
