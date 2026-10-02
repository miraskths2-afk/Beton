-- =====================================================================
-- PROBETON: новые способы выгрузки бетона + админ удаляет чаты
-- =====================================================================
-- Что делает:
--   1. Разрешает в заявке новые способы выгрузки: кран с бадьёй,
--      бетоноконвейер, миксер с насосом, стационарный насос, вручную.
--      (Раньше база принимала только «слив» и «автобетононасос».)
--   2. Отдельный чат «заказчик ↔ завод» (колонка channel у сообщений).
--      Чат «заказчик ↔ миксерист» остаётся как был. Старые сообщения
--      завода переносятся в чат с заводом.
--   3. Разрешает удалять записи голосовых сообщений из хранилища,
--      когда админ удаляет сообщение или переписку — чтобы файлы
--      не копились. Сами сообщения удалять уже можно, тут ничего
--      менять не нужно.
--
-- Можно запускать сколько угодно раз — ничего не сломается и
-- данные не пропадут. Старые заявки остаются как есть.
--
-- Куда вставлять: Supabase → SQL Editor → New query → вставить
-- весь файл → Run. Запускать ДО вливания изменений на сайт.
-- =====================================================================

-- 1. Способы выгрузки
alter table orders drop constraint if exists orders_unload_method_check;
alter table orders add constraint orders_unload_method_check
  check (unload_method is null or unload_method in (
    'slide',        -- прямой слив из миксера (по лотку)
    'pump',         -- автобетононасос
    'crane',        -- кран с бадьёй
    'conveyor',     -- бетоноконвейер (лента)
    'mixer_pump',   -- миксер с насосом
    'line_pump',    -- стационарный бетононасос
    'wheelbarrow'   -- вручную (тачки, вёдра)
  ));

-- 2. Отдельный чат с заводом
alter table order_messages add column if not exists channel text;
do $$ begin
  alter table order_messages add constraint order_messages_channel_check
    check (channel is null or channel in ('plant'));
exception when duplicate_object then null; end $$;
create index if not exists order_messages_order_channel_idx
  on order_messages (order_id, channel);
update order_messages set channel = 'plant'
where sender_role = 'plant' and channel is null and order_id is not null;

-- 3. Удаление файлов голосовых сообщений
drop policy if exists "chat_voice_delete" on storage.objects;
create policy "chat_voice_delete" on storage.objects
  for delete using (bucket_id = 'chat-voice');

-- Проверка: должно показать одну строку с новым списком способов.
select pg_get_constraintdef(oid) as unload_methods
from pg_constraint
where conname = 'orders_unload_method_check';
