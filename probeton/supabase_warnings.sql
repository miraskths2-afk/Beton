-- ============================================================
-- ПРЕДУПРЕЖДЕНИЯ, ЖАЛОБЫ И ОТМЕНА ЗАКАЗА ЧЕРЕЗ АДМИНА
--  * Заказчик: каждая отмена заказа = предупреждение. 3 предупреждения —
--    номер попадает в чёрный список.
--  * Миксерист: сам отменить заказ не может, только попросить админа.
--    Если причина неуважительная — админ отменяет с предупреждением.
--    3 предупреждения — чёрный список.
--  * Жалоба миксериста «клиент не оплатил» больше не заносит клиента в
--    чёрный список сразу: она приходит админу, и решает админ.
--  * Когда админ убирает номер из чёрного списка (после оплаты штрафа),
--    счётчик предупреждений этого человека обнуляется.
-- Безопасно запускать повторно.
-- Вставьте целиком в Supabase -> SQL Editor -> Run.
-- ============================================================

-- Счётчик предупреждений у каждого пользователя.
alter table app_users add column if not exists warnings int not null default 0;

-- Кто отменил заказ, и запрос миксериста на отмену.
alter table orders add column if not exists cancelled_by text;
alter table orders add column if not exists cancel_requested_at timestamptz;
alter table orders add column if not exists cancel_request_reason text;

-- Жалобы (пока только «клиент не оплатил» от миксериста).
create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  order_id uuid,
  from_user_id uuid,
  from_name text,
  against_phone text not null,
  reason text,
  status text not null default 'open',
  resolved_at timestamptz
);
do $$ begin
  alter table complaints
    add constraint complaints_status_check
    check (status in ('open', 'accepted', 'rejected'));
exception when duplicate_object then null; end $$;

alter table complaints enable row level security;
drop policy if exists "complaints_all" on complaints;
create policy "complaints_all" on complaints for all using (true) with check (true);
grant all on complaints to anon, authenticated;

do $$ begin alter publication supabase_realtime add table complaints;
exception when duplicate_object then null; end $$;

-- Выдать предупреждение. На третьем номер попадает в чёрный список.
-- Возвращает новое число предупреждений.
create or replace function add_warning(p_user_id uuid, p_reason text)
returns int
language plpgsql
as $$
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
$$;
grant execute on function add_warning(uuid, text) to anon, authenticated;

-- Убрали номер из чёрного списка — обнуляем предупреждения.
create or replace function reset_warnings_on_unblacklist()
returns trigger
language plpgsql
as $$
begin
  update app_users
     set warnings = 0
   where right(regexp_replace(phone, '\D', '', 'g'), 10) =
         right(regexp_replace(old.phone, '\D', '', 'g'), 10);
  return old;
end;
$$;

drop trigger if exists blacklist_reset_warnings on blacklist;
create trigger blacklist_reset_warnings
  after delete on blacklist
  for each row execute function reset_warnings_on_unblacklist();

select 'ГОТОВО: предупреждения и жалобы включены' as result;
