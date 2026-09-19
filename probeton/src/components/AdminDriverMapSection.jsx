import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchLocations, subscribeToLocations } from "@/lib/driverLocation";
import { supabase } from "@/api/base44Client";
import { Phone, Eye } from "lucide-react";

const truckIcon = (highlighted) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${
      highlighted ? "#f59e0b" : "#22c55e"
    };width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #171717;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:16px">🚚</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 0.8 });
  }, [position]);
  return null;
}

const ALMATY = [43.238, 76.945];

export default function AdminDriverMapSection() {
  const [drivers, setDrivers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const locs = await fetchLocations();
      if (!mounted) return;
      if (locs.length === 0) {
        setDrivers([]);
        return;
      }
      const ids = locs.map((l) => l.driver_id);
      const { data: users } = await supabase
        .from("app_users")
        .select("id, phone, vehicle_plate")
        .in("id", ids);
      const merged = locs.map((l) => {
        const u = users?.find((x) => x.id === l.driver_id);
        return { ...l, phone: u?.phone, vehicle_plate: u?.vehicle_plate };
      });
      setDrivers(merged);
    };

    load();
    const unsub = subscribeToLocations(load);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const selected = drivers.find((d) => d.driver_id === selectedId);
  const center = drivers[0] ? [drivers[0].lat, drivers[0].lng] : ALMATY;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
        <MapContainer
          center={center}
          zoom={11}
          style={{ height: "40vh", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          {selected && <FlyTo position={[selected.lat, selected.lng]} />}
          {drivers.map((d) => (
            <Marker
              key={d.driver_id}
              position={[d.lat, d.lng]}
              icon={truckIcon(d.driver_id === selectedId)}
              eventHandlers={{ click: () => setSelectedId(d.driver_id) }}
            >
              <Popup>
                <div style={{ minWidth: "140px" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>
                    {d.driver_name || "Водитель"}
                  </div>
                  <div style={{ color: "#666", fontSize: "11px" }}>
                    Обновлено: {new Date(d.updated_at).toLocaleTimeString("ru-RU")}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-neutral-900 px-1 text-sm">
          Миксеристы на линии ({drivers.length})
        </h3>
        {drivers.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
            Сейчас никто не на линии
          </div>
        ) : (
          <div className="space-y-2">
            {drivers.map((d) => (
              <div
                key={d.driver_id}
                className={`bg-white rounded-xl p-3 border flex items-center justify-between gap-2 transition-colors ${
                  d.driver_id === selectedId
                    ? "border-amber-400 ring-1 ring-amber-300"
                    : "border-neutral-200"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-neutral-900 truncate">
                    {d.driver_name || "Водитель"}
                  </div>
                  {d.vehicle_plate && (
                    <div className="text-xs text-neutral-500">{d.vehicle_plate}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setSelectedId(d.driver_id)}
                    className="p-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                    title="Наблюдать на карте"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {d.phone && (
                    <a
                      href={`tel:${d.phone}`}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                      title="Позвонить"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
