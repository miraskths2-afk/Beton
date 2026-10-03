-- Версия 2.0: заказ привязан к аккаунту клиента.
-- Раньше заказ «принадлежал» тому номеру, который вписан в заявку.
-- Теперь в заказе запоминается ещё и аккаунт, из которого его создали,
-- поэтому клиент видит свой заказ, даже если указал другой номер.
-- Безопасно: только добавляет пустую колонку, старые данные не меняет.
alter table public.orders
  add column if not exists client_id uuid references public.app_users(id) on delete set null;

create index if not exists orders_client_id_idx on public.orders (client_id);

select 'ГОТОВО: заказы теперь привязаны к аккаунту клиента' as result;
