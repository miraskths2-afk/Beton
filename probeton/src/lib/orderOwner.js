// Чей это заказ. Заказ принадлежит клиенту, если он создан из его
// аккаунта (client_id) или на его номер телефона. Так заказ виден
// клиенту, даже если в заявке он указал другой номер (например, прораба),
// а заказ, оформленный на его номер кем-то другим, тоже виден ему.
import { normPhone } from "@/lib/orderStatuses";

export function isMyOrder(order, user) {
  if (!order || !user) return false;
  if (order.client_id && user.id && order.client_id === user.id) return true;
  const mine = normPhone(user.phone);
  return !!mine && normPhone(order.phone) === mine;
}

// Создать строку заказа с client_id. Если в базе ещё нет колонки
// client_id (не выполнен supabase_v2_zakaz_klienta.sql), пробуем без неё, чтобы
// заказы не ломались.
export async function insertWithClientId(insertFn, row) {
  try {
    return await insertFn(row);
  } catch (err) {
    if (row.client_id !== undefined && /client_id/.test(String(err?.message || err))) {
      const rest = { ...row };
      delete rest.client_id;
      return await insertFn(rest);
    }
    throw err;
  }
}
