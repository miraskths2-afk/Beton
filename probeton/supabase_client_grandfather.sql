-- Разово переводит уже существующих заказчиков в "одобрено", чтобы
-- никого не заблокировать задним числом новым правилом повторного входа.
-- Водителей и админов не трогает.
-- Вставьте в Supabase -> SQL Editor -> Run (безопасно запускать один раз;
-- повторный запуск ничего не изменит для тех, кто уже вышел и ждёт
-- одобрения заново).

update app_users
set approval_status = 'approved'
where role <> 'admin'
  and (account_type is distinct from 'driver')
  and approval_status = 'pending';
