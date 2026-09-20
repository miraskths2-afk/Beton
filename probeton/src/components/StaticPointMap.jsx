import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2563eb;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,.35)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Простая карта с одной неподвижной точкой — для показа местоположения
// прораба, перехватившего остаток.
export default function StaticPointMap({ lat, lng, label, height = "28vh" }) {
  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height, width: "100%" }}
        scrollWheelZoom={false}
        dragging={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <Marker position={[lat, lng]} icon={pinIcon}>
          {label && <Popup>{label}</Popup>}
        </Marker>
      </MapContainer>
    </div>
  );
}
