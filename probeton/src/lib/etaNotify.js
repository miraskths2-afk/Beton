// «Машина будет через ~15 минут» — сообщение заказчику.
//
// Работает, пока миксерист/насосник «на линии»: DriverLocationBroadcaster
// отдаёт сюда каждую точку GPS. Для своих активных заказов считаем время
// в пути по дорогам (бесплатный OSRM, как на карте заказа). Когда до
// объекта осталось ETA_MIN минут или меньше и машина действительно едет
// к объекту (стала ближе, чем была), ставим orders.eta_notified_at —
// база сама отправит заказчику push (supabase_push.sql). Повторно не шлём.

import { supabase } from "@/api/base44Client";
import { distanceKm } from "@/lib/geo";

const ETA_MIN = 15;
const CHECK_KM = 25; // дальше — точно больше 15 минут, OSRM не спрашиваем
const FALLBACK_KM = 6; // OSRM недоступен — считаем по прямой
const APPROACH_KM = 0.5; // насколько машина должна приблизиться
const ROUTE_EVERY_MS = 60 * 1000;
const REFRESH_MS = 60 * 1000;

let cache = { userId: null, at: 0, orders: [] };
let loading = null;
const maxDist = new Map();
const lastRouteAt = new Map();
const done = new Set();

async function myOrders(userId) {
  if (cache.userId === userId && Date.now() - cache.at < REFRESH_MS) return cache.orders;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, delivery_lat, delivery_lng")
        .eq("driver_id", userId)
        .is("arrived_at", null)
        .is("eta_notified_at", null)
        .in("status", ["in_progress", "sent_to_plant", "manufacturing", "en_route"]);
      if (error) throw error;
      cache = { userId, at: Date.now(), orders: data || [] };
    } catch (e) {
      console.error(e);
      cache = { userId, at: Date.now(), orders: [] };
    } finally {
      loading = null;
    }
    return cache.orders;
  })();
  return loading;
}

async function routeMinutes(lat, lng, o) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${o.delivery_lng},${o.delivery_lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const sec = data?.routes?.[0]?.duration;
    return sec == null ? null : sec / 60;
  } catch {
    return null;
  }
}

async function markNotified(o) {
  done.add(o.id);
  const { error } = await supabase
    .from("orders")
    .update({ eta_notified_at: new Date().toISOString() })
    .eq("id", o.id)
    .is("eta_notified_at", null);
  if (error) {
    console.error(error);
    done.delete(o.id);
  }
  cache.at = 0;
}

export async function checkEta(userId, lat, lng) {
  if (!userId) return;
  const orders = await myOrders(userId);
  for (const o of orders) {
    if (done.has(o.id) || o.delivery_lat == null || o.delivery_lng == null) continue;
    const km = distanceKm(lat, lng, o.delivery_lat, o.delivery_lng);
    if (km == null) continue;
    const prevMax = maxDist.get(o.id) ?? km;
    maxDist.set(o.id, Math.max(prevMax, km));
    // Ещё не приближалась (например, стоит у завода рядом с объектом).
    if (Math.max(prevMax, km) - km < APPROACH_KM || km > CHECK_KM) continue;
    if (Date.now() - (lastRouteAt.get(o.id) || 0) < ROUTE_EVERY_MS) continue;
    lastRouteAt.set(o.id, Date.now());

    const min = await routeMinutes(lat, lng, o);
    const near = min != null ? min <= ETA_MIN : km <= FALLBACK_KM;
    if (near) await markNotified(o);
  }
}
