import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

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

// value: {lat, lng} | null. onChange({lat, lng}).
export default function LocationPicker({ value, onChange, height = "35vh" }) {
  const [center] = useState(value || { lat: ALMATY[0], lng: ALMATY[1] });

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
          <ClickHandler onPick={onChange} />
          {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
        </MapContainer>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        {value
          ? `Точка выбрана: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : "Нажмите на карту, чтобы отметить место объекта"}
      </div>
    </div>
  );
}
