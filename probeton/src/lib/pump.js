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

// Стационарный насос хранится в pump_boom как 1 (стрелы у него нет).
export const PUMP_STATIONARY = 1;

// Длины стрелы АБН, м, + стационарный насос. Подсказка — примерно куда достаёт.
export const PUMP_BOOMS = [24, 28, 32, 37, 42, 47, 52, 56, 62, 65, PUMP_STATIONARY];

export const PUMP_BOOM_HINTS = {
  24: "Частный дом, фундамент, 1–3 этажа",
  28: "Коттедж, малоэтажка до 5 этажей",
  32: "До 7–8 этажей или подача вглубь участка",
  36: "До 9–10 этажей",
  37: "До 9–10 этажей",
  42: "Многоэтажка до 12–13 этажей",
  47: "Высотные работы, подача через здание",
  52: "Высокие и дальние подачи",
  56: "Высотки, подача далеко через здание",
  62: "Очень высокие и дальние подачи",
  65: "Самые высокие и дальние подачи",
  [PUMP_STATIONARY]: "Подача по трубам на высоту или далеко, где стрела не достаёт",
};

// Средние цены по рынку за час (из чата насосников), ₸. Админ меняет их
// на странице «Партнёры» → «АБН»; пока там 0 — берётся эта цена.
export const PUMP_DEFAULT_RATES = {
  24: 40000,
  28: 40000,
  32: 40000,
  36: 40000,
  37: 40000,
  42: 45000,
  47: 50000,
  52: 55000,
  56: 60000,
  62: 65000,
  65: 70000,
  [PUMP_STATIONARY]: 50000,
};

// Сбор сайта с насосника за каждый оплаченный час (меняет админ).
export const PUMP_DEFAULT_FEE = 1000;

// «37 м» или «Стационарный».
export function boomLabel(boom) {
  if (Number(boom) === PUMP_STATIONARY) return t("Стационарный");
  return boom ? t("{m} м", { m: boom }) : "?";
}

// «АБН 37 м» / «Стационарный насос».
export function pumpTitle(boom) {
  if (Number(boom) === PUMP_STATIONARY) return t("Стационарный насос");
  return t("АБН {m} м", { m: boom || "?" });
}

export const isPumpOrder = (o) => o?.service_type === "pump";
export const isPumpUser = (u) => u?.account_type === "pump";

// «Миксерист» или «Насосник» — кто исполняет эту заявку.
export function workerLabel(o) {
  return isPumpOrder(o) ? "Насосник" : "Миксерист";
}

// Цена за час для длины стрелы: из настроек админа, а если там 0 —
// средняя цена по рынку.
export function pumpRateFor(settings, boom) {
  const v = Number(settings?.pump_rates?.[String(boom)] || 0);
  if (v > 0) return v;
  return PUMP_DEFAULT_RATES[Number(boom)] || null;
}

// Сбор сайта с насосника за час.
export function pumpFeePerHour(settings) {
  const v = settings?.pump_fee_per_hour;
  return v != null && Number(v) >= 0 ? Number(v) : PUMP_DEFAULT_FEE;
}

// Сколько часов оплачивается: не меньше 3, не меньше заказанных,
// по таймеру — каждый начатый час.
export function pumpBilledHours(o, now = Date.now()) {
  let worked = Math.ceil(Number(o?.pump_hours_actual || 0));
  if (!worked && o?.arrived_at) {
    const end = o.unloaded_at ? new Date(o.unloaded_at).getTime() : now;
    worked = Math.ceil(Math.max(0, end - new Date(o.arrived_at).getTime()) / 3600000);
  }
  return Math.max(PUMP_MIN_HOURS, Number(o?.pump_hours || 0), worked);
}

// Сбор сайта с насосника за эту заявку.
export function pumpServiceFee(o, settings) {
  if (o?.pump_service_fee != null && o?.unloaded_at) return Number(o.pump_service_fee);
  const rate = o?.pump_fee_rate != null ? Number(o.pump_fee_rate) : pumpFeePerHour(settings);
  return pumpBilledHours(o) * rate;
}

// Сколько платить сразу: часы (не меньше 3) × цена.
export function pumpPrepay(o) {
  const rate = Number(o?.pump_rate || 0);
  if (!rate) return null;
  return Math.max(PUMP_MIN_HOURS, Number(o?.pump_hours || 0)) * rate;
}

// Итог по факту: оплачиваемые часы (не меньше заказанных и не меньше 3).
export function pumpFinalTotal(o) {
  const rate = Number(o?.pump_rate || 0);
  if (!rate) return null;
  return pumpBilledHours(o) * rate;
}

export function pumpSummary(o) {
  const parts = [pumpTitle(o?.pump_boom)];
  if (o?.pump_hours) parts.push(t("{n} ч", { n: o.pump_hours }));
  return parts.join(" · ");
}

// Понятная ошибка, если supabase_pump.sql ещё не выполнен.
export function pumpErrorText(err) {
  const msg = String(err?.message || err || "");
  if (
    /(service_type|pump_boom|pump_hours|pump_rate|pump_prepaid|pump_for_order_id|pump_hire_open|pump_rates|pump_fee|pump_service_fee|pump_start|pump_finish)/.test(msg) ||
    /order_messages_channel_check/.test(msg) ||
    // Старое сообщение без насосников = supabase_pump.sql не выполнен.
    /только миксериста(?! или насосника)/.test(msg)
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
      what_needed: `${Number(boom) === PUMP_STATIONARY ? "Стационарный насос" : `АБН ${boom} м`} на ${h} ч, адрес: ${address}`,
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

// Таймер насоса: время идёт с момента, как насос встал на лапы.
export async function pumpStart(driverId, orderId) {
  const { data, error } = await supabase.rpc("pump_start", {
    p_driver_id: driverId,
    p_order_id: orderId,
  });
  if (error) throw error;
  return data;
}

// Подача закончена: считаем часы и сбор сайта.
export async function pumpFinish(driverId, orderId) {
  const { data, error } = await supabase.rpc("pump_finish", {
    p_driver_id: driverId,
    p_order_id: orderId,
  });
  if (error) throw error;
  return data;
}
