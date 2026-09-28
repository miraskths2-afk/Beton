-- ============================================================
-- ОТКАТ supabase_security_v4.sql (только если что-то пошло не так).
-- Убирает защитные триггеры и новые правила доступа. Баланс,
-- пополнения и настройки остаются в базе — ничего не удаляется.
-- После этого файла запустите supabase_master_check_v3.sql, чтобы
-- вернуть открытый доступ для старой версии сайта, и откатите
-- деплой в Vercel на предыдущую версию.
-- ============================================================

drop trigger if exists trg_protect_app_users on app_users;
drop trigger if exists trg_protect_orders_insert on orders;
drop trigger if exists trg_protect_orders_update on orders;
drop trigger if exists trg_protect_leftovers_update on leftovers;

drop policy if exists "orders_select" on orders;
drop policy if exists "orders_insert" on orders;
drop policy if exists "orders_update" on orders;
drop policy if exists "orders_delete" on orders;
drop policy if exists "leftovers_delete" on leftovers;
drop policy if exists "blacklist_select" on blacklist;
drop policy if exists "blacklist_insert" on blacklist;
drop policy if exists "blacklist_delete" on blacklist;
drop policy if exists "order_messages_select" on order_messages;
drop policy if exists "order_messages_insert" on order_messages;
