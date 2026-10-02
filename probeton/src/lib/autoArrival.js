// Автозапуск таймера на объекте, если миксерист или насосник забыл нажать
// кнопку. Работает, пока водитель «на линии» (DriverLocationBroadcaster
// отдаёт сюда каждую новую точку GPS): если машина стоит ближе NEAR_KM к
// точке объекта дольше HOLD_MS, запускаем таймер сами — у миксера таймер
// простоя (mark_arrived), у насоса таймер работы (pump_start).

import { supabase } from "@/api/base44Client";
import { distanceKm } from "@/lib/geo";
import { markArrived } from "@/lib/orderExtras";
import { isPumpOrder, pumpStart } from "@/lib/pump";
import { notify } from "@/lib/notifications";
import { t } from "@/lib/i18n";

const NEAR_KM = 0.2;
const HOLD_MS = 60 * 1000;
const REFRESH_MS = 30 * 1000;

let cache = { userId: null, at: 0, orders: [] };
let loading = null;
let lastPos = null;
const nearSince = new Map();
const timers = new Map();
const started = new Set();

async function myWaitingOrders(userId) {
  if (cache.userId === userId && Date.now() - cache.at < REFRESH_MS) return cache.orders;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, service_type, status, arrived_at, delivery_lat, delivery_lng")
        .eq("driver_id", userId)
        .is("arrived_at", null)
        .not("status", "in", "(new,done,cancelled)");
      if (error) throw error;
      cache = { userId, at: Date.now(), orders: data || [] };
    } catch (e) {
      // Нет колонок (SQL ещё не выполнен) или нет сети — просто не автозапускаем.
      console.error(e);
      cache = { userId, at: Date.now(), orders: [] };
    } finally {
      loading = null;
    }
    return cache.orders;
  })();
  return loading;
}

const isNear = (o, pos) =>
  pos &&
  o.delivery_lat != null &&
  o.delivery_lng != null &&
  distanceKm(pos.lat, pos.lng, o.delivery_lat, o.delivery_lng) <= NEAR_KM;

async function start(userId, o) {
  if (started.has(o.id)) return;
  started.add(o.id);
  try {
    if (isPumpOrder(o)) await pumpStart(userId, o.id);
    else await markArrived(userId, o.id);
    cache.at = 0;
    notify(
      t("Таймер запущен"),
      isPumpOrder(o)
        ? t("Вы на объекте — таймер насоса запустился сам")
        : t("Вы на объекте — таймер простоя запустился сам")
    );
  } catch (e) {
    console.error(e);
    started.delete(o.id);
  }
}

function check(userId, o) {
  const since = nearSince.get(o.id);
  if (since && Date.now() - since >= HOLD_MS && isNear(o, lastPos)) start(userId, o);
}

export async function onDriverPosition(userId, lat, lng) {
  if (!userId) return;
  lastPos = { lat, lng };
  const orders = await myWaitingOrders(userId);
  for (const o of orders) {
    if (started.has(o.id)) continue;
    if (!isNear(o, lastPos)) {
      nearSince.delete(o.id);
      clearTimeout(timers.get(o.id));
      timers.delete(o.id);
      continue;
    }
    if (!nearSince.has(o.id)) {
      nearSince.set(o.id, Date.now());
      // GPS может молчать, пока машина стоит, — проверим ещё раз по таймеру.
      timers.set(o.id, setTimeout(() => check(userId, o), HOLD_MS + 1000));
    } else {
      check(userId, o);
    }
  }
}
