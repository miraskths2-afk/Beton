-- ЧАТ: миксерист ↔ клиент (обычные заявки + Кубовик)
--
-- Как запустить: Supabase → SQL Editor → New query → вставьте весь этот
-- файл → Run. Можно запускать повторно — ничего не сломается.
--
-- Используем ту же таблицу order_messages, что и раньше (старая
-- переписка по заказам сохранится), и расширяем её:
--   leftover_id — чат по остатку из Кубовика
--   sender_id   — кто именно написал (id из app_users)
--   read_at     — когда собеседник прочитал (для галочек ✓✓)

create table if not exists order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  sender_role text not null,
  sender_name text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table order_messages alter column order_id drop not null;
alter table order_messages add column if not exists leftover_id uuid;
alter table order_messages add column if not exists sender_id uuid;
alter table order_messages add column if not exists read_at timestamptz;

-- Сообщение относится либо к заказу, либо к остатку.
do $$ begin
  alter table order_messages
    add constraint order_messages_one_chat
    check (order_id is not null or leftover_id is not null);
exception when duplicate_object then null; end $$;

create index if not exists order_messages_order_idx
  on order_messages (order_id, created_at);
create index if not exists order_messages_leftover_idx
  on order_messages (leftover_id, created_at);
create index if not exists order_messages_created_idx
  on order_messages (created_at desc);

alter table order_messages enable row level security;
drop policy if exists "order_messages_all" on order_messages;
create policy "order_messages_all" on order_messages for all using (true) with check (true);

-- Чтобы галочки «прочитано» обновлялись у собеседника мгновенно.
alter table order_messages replica identity full;

do $$ begin
  alter publication supabase_realtime add table order_messages;
exception when duplicate_object then null; end $$;

-- ===== Проверьте после запуска: =====
-- Table Editor → order_messages: есть колонки leftover_id, sender_id, read_at
