// Кубовик: остатки бетона, которые миксерист отдаёт со скидкой.
// Миксерист публикует остаток (марка, кубы, цена, сколько актуально),
// заказчик принимает его — после этого оба видят номера друг друга.
// Завершает сделку только админ, по запросу одной из сторон.
// SQL для этого — supabase_v2_kubovik.sql.
import { supabase } from "@/api/base44Client";
import { normPhone } from "@/lib/orderStatuses";
import { t } from "@/lib/i18n";

// Остаток ещё в ленте: свободен и время не вышло.
export function isLeftoverLive(l, now = Date.now()) {
  if (l?.status !== "available") return false;
  return !l.expires_at || new Date(l.expires_at).getTime() > now;
}

// Это сделка текущего пользователя как заказчика?
export function isMyLeftoverDeal(user, l) {
  if (!user || !l || !l.intercepted_by_phone) return false;
  if (l.intercepted_by_user_id && l.intercepted_by_user_id === user.id) return true;
  return !!user.phone && normPhone(l.intercepted_by_phone) === normPhone(user.phone);
}

// Текущая (не завершённая) сделка заказчика, если есть.
export function findActiveDeal(user, leftovers) {
  return (leftovers || []).find(
    (l) => l.status === "intercepted" && isMyLeftoverDeal(user, l)
  );
}

export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // отказ — не блокируем действие
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

// Принять остаток. Сервер сам проверит, что остаток ещё свободен и что
// у заказчика нет другой незавершённой сделки.
export async function acceptLeftover(userId, leftoverId) {
  const pos = await getCurrentPosition();
  const { data, error } = await supabase.rpc("accept_leftover", {
    p_user_id: userId,
    p_id: leftoverId,
    p_lat: pos?.lat ?? null,
    p_lng: pos?.lng ?? null,
  });
  if (error) {
    const msg = error.message || "";
    if (/accept_leftover|schema cache/i.test(msg)) {
      throw new Error("В базе ещё не выполнен файл supabase_v2_kubovik.sql.");
    }
    throw new Error(msg);
  }
  return data;
}

// Запрос админу на завершение сделки (от миксериста или заказчика).
export async function requestLeftoverClose(id, by, note) {
  const { error } = await supabase
    .from("leftovers")
    .update({
      close_requested_at: new Date().toISOString(),
      close_requested_by: by,
      close_request_note: (note || "").trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
}

// Решение админа: завершить сделку или отклонить запрос.
export async function resolveLeftoverClose(id, complete) {
  const fields = {
    close_requested_at: null,
    close_requested_by: null,
    close_request_note: null,
  };
  if (complete) {
    fields.status = "gone";
    fields.completed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("leftovers").update(fields).eq("id", id);
  if (error) throw error;
}

export function formatRemaining(ms) {
  if (ms <= 0) return t("Истёк");
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return t("{h}ч {m}м", { h, m });
  if (m > 0) return t("{m}м {s}с", { m, s });
  return t("{s}с", { s });
}

// Запрос админу на завершение сделки. Возвращает true, если отправлен.
export async function askAdminToClose(l, by) {
  const note = prompt(
    t("Сообщение админу: остаток забрали? Можно оставить пустым.")
  );
  if (note === null) return false;
  try {
    await requestLeftoverClose(l.id, by, note);
    return true;
  } catch (e) {
    console.error(e);
    alert(t("Не удалось отправить запрос. Попробуйте ещё раз."));
    return false;
  }
}

