import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchLocations, subscribeToLocations } from "@/lib/driverLocation";
import { t } from "@/lib/i18n";

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="background:#22c55e;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #171717;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:16px">🚚</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2563eb;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,.35)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Подгоняет масштаб карты так, чтобы обе точки (водитель + объект)
// были видны одновременно.
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [JSON.stringify(points)]);
  return null;
}

// Бесплатный сервис маршрутизации (OSRM, публичный демо-сервер) —
// строит кратчайший маршрут по дорогам между двумя точками.
async function fetchRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.routes?.[0];
    const coords = r?.geometry?.coordinates;
    if (!coords) return null;
    // GeoJSON отдаёт [lng, lat] — Leaflet ждёт [lat, lng].
    return {
      points: coords.map(([lng, lat]) => [lat, lng]),
      durationMin: Math.round((r.duration || 0) / 60),
      distanceKm: Math.round((r.distance || 0) / 100) / 10,
    };
  } catch (e) {
    console.error("fetchRoute error", e);
    return null;
  }
}

// driverId: id водителя, чьё живое местоположение показываем.
// destination: {lat, lng} — точка объекта (адрес доставки).
export default function OrderRouteMap({ driverId, destination, height = "45vh" }) {
  const [driverPos, setDriverPos] = useState(null);
  const [route, setRoute] = useState(null);
  const lastRouteFetch = useRef(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const locs = await fetchLocations([driverId]);
      if (!mounted) return;
      const d = locs[0];
      if (d) setDriverPos({ lat: d.lat, lng: d.lng });
    };
    load();
    const unsub = subscribeToLocations(load);
    return () => {
      mounted = false;
      unsub();
    };
  }, [driverId]);

  // Маршрут пересчитываем не чаще раза в 20 секунд — чтобы не
  // перегружать бесплатный сервис маршрутизации на каждое обновление GPS.
  useEffect(() => {
    if (!driverPos || !destination) return;
    const now = Date.now();
    if (now - lastRouteFetch.current < 20000 && route) return;
    lastRouteFetch.current = now;
    fetchRoute(driverPos, destination).then((r) => {
      if (r) setRoute(r);
    });
     
  }, [driverPos?.lat, driverPos?.lng, destination?.lat, destination?.lng]);

  if (!destination && !driverPos) return null;

  const points = driverPos && destination
    ? [
        [driverPos.lat, driverPos.lng],
        [destination.lat, destination.lng],
      ]
    : driverPos
    ? [[driverPos.lat, driverPos.lng]]
    : [[destination.lat, destination.lng]];

  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
      <MapContainer
        center={points[0]}
        zoom={13}
        style={{ height, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <FitBounds points={points} />

        {route && (
          <Polyline
            positions={route.points}
            pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.8 }}
          />
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={pinIcon}>
            <Popup>{t("Объект — куда везти")}</Popup>
          </Marker>
        )}

        {driverPos && (
          <Marker position={[driverPos.lat, driverPos.lng]} icon={truckIcon}>
            <Popup>{t("Миксерист сейчас здесь")}</Popup>
          </Marker>
        )}
      </MapContainer>
      {route && (
        <div className="bg-blue-50 text-blue-700 text-center py-2 text-sm font-bold">
          🚚 {t("Приедет через ~{min} мин · {km} км", { min: route.durationMin, km: route.distanceKm })}
        </div>
      )}
    </div>
  );
}
