import { t } from "@/lib/i18n";

// Расстояние между двумя точками на карте "по прямой" (в километрах),
// формула гаверсинусов. Для сортировки водителей этого достаточно —
// точный маршрут по дорогам считается уже на странице заказа (OSRM).
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || Number.isNaN(Number(v)))) {
    return null;
  }
  const R = 6371;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatKm(km) {
  if (km == null) return "";
  if (km < 1) return t("{n} м", { n: Math.round(km * 1000) });
  return t("{n} км", { n: km < 10 ? km.toFixed(1) : Math.round(km) });
}
