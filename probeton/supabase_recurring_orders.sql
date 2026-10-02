-- ============================================================
-- ПОВТОРЯЮЩИЕСЯ ЗАКАЗЫ (PROBETON)
-- "Каждый понедельник, 5 кубов, тот же адрес" — ставится один раз,
-- дальше заявка создаётся сама.
--
-- Как работает: правило хранится в таблице recurring_orders.
-- Функция generate_recurring_orders() создаёт обычную заявку в orders
-- за сутки до времени подачи (чтобы диспетчер успел назначить миксер).
-- Функция безопасна для повторного запуска: одна и та же дата по
-- одному правилу никогда не создаст две заявки.
--
-- Запускается функция автоматически каждые 15 минут через pg_cron
-- (встроен в Supabase), а также сайт сам вызывает её, когда админ
-- открывает приложение — так заявки появятся, даже если pg_cron
-- не включился.
--
-- Полностью безопасно запускать повторно.
-- Вставьте целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

create table if not exists recurring_orders (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  phone text not null,
  client_name text,
  grade text,
  cubes numeric not null,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  comment text,
  -- Дни недели: 1 = понедельник ... 7 = воскресенье
  weekdays int[] not null default '{}',
  -- Время подачи бетона на объект, "ЧЧ:ММ" по времени Алматы
  delivery_time text not null default '09:00',
  active boolean not null default true,
  created_by text
);

-- Связь заявки с правилом, по которому она создана.
alter table orders add column if not exists recurring_id uuid;
alter table orders add column if not exists recurring_date date;

-- Защита от дублей: одно правило + одна дата = одна заявка.
create unique index if not exists orders_recurring_unique
  on orders (recurring_id, recurring_date)
  where recurring_id is not null;

alter table recurring_orders enable row level security;
drop policy if exists "recurring_orders_all" on recurring_orders;
create policy "recurring_orders_all" on recurring_orders for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table recurring_orders;
exception when duplicate_object then null; end $$;

-- ===== Функция, которая создаёт заявки =====
create or replace function generate_recurring_orders()
returns integer
language plpgsql
as $$
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
$$;

grant execute on function generate_recurring_orders() to anon, authenticated;

-- ===== Автозапуск каждые 15 минут (pg_cron) =====
-- Если здесь будет ошибка про pg_cron — включите расширение вручную:
-- Supabase -> Database -> Extensions -> найдите "pg_cron" -> Enable,
-- и запустите этот файл ещё раз. Остальное уже создано и работает.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'probeton-recurring-orders',
  '*/15 * * * *',
  $$select generate_recurring_orders()$$
);

-- ===== Проверьте после запуска: =====
-- Новая таблица: recurring_orders
-- orders: + recurring_id, recurring_date
-- Database -> Functions: generate_recurring_orders
-- Integrations -> Cron (или таблица cron.job): задача probeton-recurring-orders
