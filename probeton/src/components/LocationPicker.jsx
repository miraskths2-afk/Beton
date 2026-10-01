import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Loader2 } from "lucide-react";
import { t, getLang } from "@/lib/i18n";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#171717;border:3px solid #f59e0b;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.35)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const ALMATY = [43.238, 76.945];

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Бесплатное обратное геокодирование через Nominatim (OpenStreetMap) —
// превращает координаты в читаемый адрес.
async function reverseGeocode(lat, lng) {
  try {
    const lang = getLang() === "kk" ? "kk,ru" : "ru";
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${lang}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// value: {lat, lng} | null. onChange({lat, lng}).
// onAddress (необязательно): вызывается с готовой строкой адреса,
// как только карта определит её по выбранной точке.
export default function LocationPicker({
  value,
  onChange,
  onAddress,
  height = "35vh",
}) {
  const [center] = useState(value || { lat: ALMATY[0], lng: ALMATY[1] });
  const [resolving, setResolving] = useState(false);

  const handlePick = async (point) => {
    onChange(point);
    if (!onAddress) return;
    setResolving(true);
    const address = await reverseGeocode(point.lat, point.lng);
    setResolving(false);
    if (address) onAddress(address);
  };

  return (
    <div className="space-y-1.5">
      <div className="rounded-xl overflow-hidden border border-neutral-200">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={value ? 15 : 11}
          style={{ height, width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          <ClickHandler onPick={handlePick} />
          {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
        </MapContainer>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        {resolving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
            {t("Определяем адрес...")}
          </>
        ) : (
          <>
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {value
              ? t("Точка выбрана: {coords}", {
                  coords: `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`,
                })
              : t("Нажмите на карту, чтобы отметить место объекта")}
          </>
        )}
      </div>
    </div>
  );
}
