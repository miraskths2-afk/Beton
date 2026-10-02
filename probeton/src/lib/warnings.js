// Предупреждения и отмены заказов.
// Заказчик: каждая отмена заказа — предупреждение.
// Миксерист: предупреждение, если админ счёл причину отмены неуважительной.
// На WARN_LIMIT-м предупреждении номер попадает в чёрный список (это
// делает функция add_warning в базе, см. supabase_warnings.sql). Выйти
// оттуда можно, оплатив штраф — сумму обговаривают с диспетчером, и он
// убирает номер из списка (предупреждения при этом обнуляются).

import { supabase } from "@/api/base44Client";
import { t } from "@/lib/i18n";

export const WARN_LIMIT = 3;

export async function addWarning(userId, reason) {
  const { data, error } = await supabase.rpc("add_warning", {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) throw error;
  return Number(data || 0);
}

// Отмена заказа самим заказчиком: предупреждаем заранее, отменяем,
// выдаём предупреждение. Возвращает true, если заказ отменён.
export async function cancelOrderAsClient(order, user) {
  const current = Number(user?.warnings || 0);
  const next = current + 1;
  const text =
    next >= WARN_LIMIT
      ? t("Внимание! Это ваша {n}-я отмена. После неё ваш номер попадёт в чёрный список, и заказывать будет нельзя. Чтобы выйти из списка, нужно оплатить штраф — сумму обговорите с диспетчером. Всё равно отменить?", { n: next })
      : t("Каждая отмена заказа — это предупреждение. Это будет {n}-е из {limit}. После {limit}-го ваш номер попадёт в чёрный список. Отменить заказ?", { n: next, limit: WARN_LIMIT });
  if (!confirm(text)) return false;

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancelled_by: "client" })
    .eq("id", order.id);
  if (error) throw error;

  if (user?.id && user?.role !== "admin") {
    const count = await addWarning(user.id, "отмена заказа");
    if (count >= WARN_LIMIT) {
      alert(t("Заказ отменён. Это была {n}-я отмена — ваш номер в чёрном списке. Чтобы снова заказывать, свяжитесь с диспетчером и оплатите штраф.", { n: count }));
    } else {
      alert(t("Заказ отменён. Предупреждение {n} из {limit}.", { n: count, limit: WARN_LIMIT }));
    }
  }
  return true;
}

// Отмена админом — без предупреждения.
export async function cancelOrderAsAdmin(orderId) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancelled_by: "admin" })
    .eq("id", orderId);
  if (error) throw error;
}
