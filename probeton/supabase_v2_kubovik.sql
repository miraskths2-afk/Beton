-- Версия 2.0: новый Кубовик.
--
-- Что меняется:
--  * миксерист публикует остаток без адреса: марка, кубы, цена, время
--    актуальности. Точка на карте — где он стоит (post_lat/post_lng),
--    а пока он «на линии» — его живое положение;
--  * заказчик принимает остаток через функцию accept_leftover: у одного
--    заказчика может быть только одна сделка Кубовика одновременно;
--  * завершить сделку может только админ. Миксерист и заказчик
--    отправляют админу запрос (close_requested_*).
--
-- Можно выполнять повторно. Старый сайт продолжает работать и после
-- этого файла (подпись функции publish_leftover не меняется).

alter table public.leftovers
  add column if not exists post_lat double precision,
  add column if not exists post_lng double precision,
  add column if not exists intercepted_by_user_id uuid,
  add column if not exists close_requested_at timestamptz,
  add column if not exists close_requested_by text,
  add column if not exists close_request_note text;

-- Публикация остатка: адрес больше не обязателен; админ тоже может
-- публиковать (когда смотрит сайт в режиме «Миксерист»).
create or replace function public.publish_leftover(
  p_user_id uuid, p_grade text, p_cubes numeric, p_direction text,
  p_price numeric, p_phone text, p_minutes integer)
 returns leftovers
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user app_users;
  v_fee numeric;
  v_row leftovers;
begin
  select * into v_user from app_users where id = p_user_id for update;
  if not found or not (
       v_user.role = 'admin'
       or (v_user.account_type = 'driver' and v_user.approval_status = 'approved')
     ) then
    raise exception 'Публиковать остатки может только одобренный миксерист';
  end if;
  if p_cubes is null or p_cubes <= 0 or p_cubes > 15 then
    raise exception 'Укажите объём от 0.5 до 15 кубов';
  end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 240 then
    raise exception 'Неверное время актуальности';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Укажите цену';
  end if;

  select leftover_post_fee into v_fee from app_settings where id = 1;
  v_fee := coalesce(v_fee, 0);
  if v_user.role = 'admin' then
    v_fee := 0;
  end if;

  if coalesce(v_user.balance, 0) < v_fee then
    raise exception 'Недостаточно средств на балансе: нужно % ₸, на балансе % ₸. Пополните баланс.',
      v_fee, coalesce(v_user.balance, 0);
  end if;

  insert into leftovers (grade, cubes, direction, price, phone, driver_id,
                         driver_name, status, expires_at)
  values (p_grade, p_cubes, nullif(trim(coalesce(p_direction, '')), ''), p_price,
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

-- Заказчик принимает остаток. Одна сделка Кубовика за раз.
create or replace function public.accept_leftover(
  p_user_id uuid, p_id uuid, p_lat double precision, p_lng double precision)
 returns leftovers
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user app_users;
  v_row leftovers;
  v_digits text;
begin
  select * into v_user from app_users where id = p_user_id;
  if not found or not (
       v_user.role = 'admin'
       or (coalesce(v_user.account_type, 'client') not in ('driver', 'pump', 'plant')
           and v_user.approval_status = 'approved')
     ) then
    raise exception 'Принимать остатки может только заказчик';
  end if;
  if coalesce(v_user.phone, '') = '' then
    raise exception 'В вашем профиле нет номера телефона';
  end if;

  -- Два быстрых нажатия подряд не должны дать две сделки.
  perform pg_advisory_xact_lock(hashtext('accept_leftover:' || p_user_id::text));

  v_digits := right(regexp_replace(v_user.phone, '\D', '', 'g'), 10);
  if exists (
    select 1 from leftovers
     where status = 'intercepted'
       and (intercepted_by_user_id = p_user_id
            or right(regexp_replace(coalesce(intercepted_by_phone, ''), '\D', '', 'g'), 10) = v_digits)
  ) then
    raise exception 'У вас уже есть сделка в Кубовике. Новую можно взять после того, как админ завершит текущую.';
  end if;

  update leftovers
     set status = 'intercepted',
         intercepted_by_phone = v_user.phone,
         intercepted_by_user_id = v_user.id,
         intercepted_lat = p_lat,
         intercepted_lng = p_lng,
         intercepted_at = now(),
         close_requested_at = null,
         close_requested_by = null,
         close_request_note = null
   where id = p_id
     and status = 'available'
     and (expires_at is null or expires_at > now())
     and driver_id is distinct from v_user.id::text
  returning * into v_row;

  if not found then
    raise exception 'Этот остаток уже приняли или его время вышло';
  end if;
  return v_row;
end;
$function$;

grant execute on function public.accept_leftover(uuid, uuid, double precision, double precision)
  to anon, authenticated;
