import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchLocations, subscribeToLocations } from "@/lib/driverLocation";
import { t, locale } from "@/lib/i18n";

// Алматы — если на карте пока никого нет.
const DEFAULT_CENTER = [43.238, 76.889];

const hotIcon = (label) =>
  L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:38px;height:38px;border-radius:50%;background:radial-gradient(circle,#f97316 55%,rgba(249,115,22,.25) 56%);box-shadow:0 0 0 6px rgba(249,115,22,.25),0 4px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:18px">🔥</div>
      <div style="margin-top:3px;background:#171717;color:#fff;font-weight:800;font-size:11px;padding:1px 6px;border-radius:6px;white-space:nowrap">${label}</div>
    </div>`,
    iconSize: [80, 60],
    iconAnchor: [40, 20],
  });

// Показать все точки сразу, когда их больше одной.
function FitAll({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(
      points.map((p) => [p.lat, p.lng]),
      { padding: [50, 50], maxZoom: 14 }
    );
  }, [key, map]);
  return null;
}

// Карта «горячих точек» Кубовика. Точка — где сейчас миксерист (если он
// на линии), иначе — где он был, когда публиковал остаток.
// Нажатие на точку — onSelect(остаток).
export default function KubovikMap({ leftovers, onSelect, height = "38vh" }) {
  const [live, setLive] = useState({});
  const driverIds = [...new Set(leftovers.map((l) => l.driver_id).filter(Boolean))];
  const idsKey = driverIds.sort().join(",");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!idsKey) {
        if (mounted) setLive({});
        return;
      }
      const data = await fetchLocations(idsKey.split(","));
      if (!mounted) return;
      const map = {};
      for (const d of data) map[d.driver_id] = d;
      setLive(map);
    };
    load();
    const unsub = subscribeToLocations(load);
    return () => {
      mounted = false;
      unsub();
    };
  }, [idsKey]);

  const points = leftovers
    .map((l) => {
      const d = live[l.driver_id];
      if (d) return { l, lat: d.lat, lng: d.lng };
      if (l.post_lat != null && l.post_lng != null)
        return { l, lat: l.post_lat, lng: l.post_lng };
      return null;
    })
    .filter(Boolean);

  const center = points.length ? [points[0].lat, points[0].lng] : DEFAULT_CENTER;

  return (
    <div className="relative isolate rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
      <MapContainer
        key={points.length ? "pts" : "empty"}
        center={center}
        zoom={11}
        style={{ height, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <FitAll points={points} />
        {points.map(({ l, lat, lng }) => (
          <Marker
            key={l.id}
            position={[lat, lng]}
            icon={hotIcon(
              `${l.cubes} м³ · ${Number(l.price || 0).toLocaleString(locale())} ₸`
            )}
            eventHandlers={{ click: () => onSelect?.(l) }}
          />
        ))}
      </MapContainer>
      {points.length === 0 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none" style={{ zIndex: 20 }}>
          <span className="bg-white/90 rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-500 shadow">
            {t("Сейчас на карте нет остатков")}
          </span>
        </div>
      )}
    </div>
  );
}
