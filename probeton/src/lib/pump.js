// АБН (автобетононасос) и насосники.
//
// Насосник — аккаунт с account_type = "pump". Работает как миксерист:
// выходит на линию, виден на карте, берёт заявки из своей ленты, чатится
// с клиентом. Кубовика у насосника нет.
// Заявка на АБН — строка в orders с service_type = "pump". Если АБН
// заказан вместе с бетоном, pump_for_order_id указывает на заявку бетона.
// Колонки в базе — supabase_pump.sql.

import { supabase } from "@/api/base44Client";
import { t } from "@/lib/i18n";

// Оплата АБН — почасовая, минимум 3 часа сразу.
export const PUMP_MIN_HOURS = 3;

// Типовые длины стрелы АБН, м. Подсказка — примерно куда достаёт.
export const PUMP_BOOMS = [24, 28, 32, 36, 42, 47, 52];

export const PUMP_BOOM_HINTS = {
  24: "Частный дом, фундамент, 1–3 этажа",
  28: "Коттедж, малоэтажка до 5 этажей",
  32: "До 7–8 этажей или подача вглубь участка",
  36: "До 9–10 этажей",
  42: "Многоэтажка до 12–13 этажей",
  47: "Высотные работы, подача через здание",
  52: "Самые высокие и дальние подачи",
};

export const isPumpOrder = (o) => o?.service_type === "pump";
export const isPumpUser = (u) => u?.account_type === "pump";

// «Миксерист» или «Насосник» — кто исполняет эту заявку.
export function workerLabel(o) {
  return isPumpOrder(o) ? "Насосник" : "Миксерист";
}

// Цена за час для длины стрелы из настроек (0 / нет — «уточняется»).
export function pumpRateFor(settings, boom) {
  const v = Number(settings?.pump_rates?.[String(boom)] || 0);
  return v > 0 ? v : null;
}

// Сколько платить сразу: часы (не меньше 3) × цена.
export function pumpPrepay(o) {
  const rate = Number(o?.pump_rate || 0);
  if (!rate) return null;
  return Math.max(PUMP_MIN_HOURS, Number(o?.pump_hours || 0)) * rate;
}

// Итог по факту: отработанные часы (не меньше заказанных и не меньше 3).
export function pumpFinalTotal(o) {
  const rate = Number(o?.pump_rate || 0);
  if (!rate) return null;
  const hours = Math.max(
    PUMP_MIN_HOURS,
    Number(o?.pump_hours || 0),
    Number(o?.pump_hours_actual || 0)
  );
  return hours * rate;
}

export function pumpSummary(o) {
  const parts = [t("АБН {m} м", { m: o?.pump_boom || "?" })];
  if (o?.pump_hours) parts.push(t("{n} ч", { n: o.pump_hours }));
  return parts.join(" · ");
}

// Понятная ошибка, если supabase_pump.sql ещё не выполнен.
export function pumpErrorText(err) {
  const msg = String(err?.message || err || "");
  if (
    /(service_type|pump_boom|pump_hours|pump_rate|pump_prepaid|pump_for_order_id|pump_hire_open|pump_rates)/.test(msg) ||
    /order_messages_channel_check/.test(msg) ||
    /только миксериста/.test(msg)
  ) {
    return t("В базе нет полей для АБН. Выполните файл supabase_pump.sql в Supabase → SQL Editor.");
  }
  return msg || t("Ошибка");
}

// Создать заявку на АБН. linkedOrder — заявка бетона, к которой нужен насос.
export async function createPumpOrder({
  boom,
  hours,
  rate,
  address,
  lat,
  lng,
  phone,
  comment,
  neededBy,
  linkedOrder,
}) {
  const h = Math.max(PUMP_MIN_HOURS, Number(hours) || PUMP_MIN_HOURS);
  const { data, error } = await supabase
    .from("orders")
    .insert({
      order_number: "АБН-" + Date.now().toString().slice(-6),
      service_type: "pump",
      what_needed: `АБН ${boom} м на ${h} ч, адрес: ${address}`,
      pump_boom: boom,
      pump_hours: h,
      pump_rate: rate || null,
      delivery_address: address,
      delivery_lat: lat ?? null,
      delivery_lng: lng ?? null,
      phone,
      comment: comment || null,
      needed_by: neededBy || null,
      pump_for_order_id: linkedOrder?.id || null,
      order_type: "quick",
      status: "new",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Заявки АБН, привязанные к заявке бетона, переходят к тому же заводу
// (если их ещё никто не взял).
export async function attachPumpOrdersToPlant(orderId, plant) {
  const { error } = await supabase
    .from("orders")
    .update({ plant_id: plant.id, plant_name: plant.name })
    .eq("pump_for_order_id", orderId)
    .eq("status", "new")
    .is("driver_id", null)
    .is("plant_id", null);
  if (error) console.error(error);
}
