import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchLocations, subscribeToLocations } from "@/lib/driverLocation";
import { vehicleIcon } from "@/lib/mapIcons";
import { t, locale } from "@/lib/i18n";

// driverIds: необязательный массив ID водителей, чтобы показать только
// конкретного водителя (для заказчика). Если не передать — показываются
// все, кто сейчас "на линии" (для админа).
// pumpIds: кто из них насосник АБН — у них свой значок 🏗️.
// emptyText: что написать, если никого из них сейчас нет на линии.
export default function LiveDriverMap({ driverIds, pumpIds = [], height = "40vh", emptyText }) {
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Пустой список — значит показывать некого (а не «всех на линии»).
      if (Array.isArray(driverIds) && driverIds.length === 0) {
        if (mounted) setDrivers([]);
        return;
      }
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
        {emptyText || t("Пока нет водителей на линии")}
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
          <Marker key={d.driver_id} position={[d.lat, d.lng]} icon={vehicleIcon(false, pumpIds.includes(d.driver_id))}>
            <Popup>
              <div style={{ minWidth: "140px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px" }}>
                  {d.driver_name || t("Водитель")}
                </div>
                <div style={{ color: "#666", fontSize: "11px" }}>
                  {t("Обновлено: {time}", { time: new Date(d.updated_at).toLocaleTimeString(locale()) })}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
