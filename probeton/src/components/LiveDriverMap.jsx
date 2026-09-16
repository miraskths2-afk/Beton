import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchLocations, subscribeToLocations } from "@/lib/driverLocation";

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="background:#22c55e;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #171717;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:16px">🚚</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

// driverIds: необязательный массив ID водителей, чтобы показать только
// конкретного водителя (для заказчика). Если не передать — показываются
// все, кто сейчас "на линии" (для админа).
export default function LiveDriverMap({ driverIds, height = "40vh" }) {
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await fetchLocations(driverIds);
      if (mounted) setDrivers(data);
    };
    load();
    const unsub = subscribeToLocations(load);
    return () => {
      mounted = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(driverIds)]);

  if (drivers.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
        Пока нет водителей на линии
      </div>
    );
  }

  const center = [drivers[0].lat, drivers[0].lng];

  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        {drivers.map((d) => (
          <Marker key={d.driver_id} position={[d.lat, d.lng]} icon={truckIcon}>
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
  );
}
