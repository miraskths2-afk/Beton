import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = (bg, emoji) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #171717;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:15px">${emoji}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

const ICONS = {
  plant: pin("#a855f7", "🏭"),
  plant_off: pin("#a3a3a3", "🏭"),
  client: pin("#3b82f6", "📍"),
  client_mine: pin("#f59e0b", "📍"),
  truck: pin("#22c55e", "🚚"),
};

const ALMATY = [43.238, 76.945];

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return;
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng]),
      { padding: [30, 30], maxZoom: 14 }
    );
  }, [key]);
  return null;
}

// Карта с точками: заводы (для админа) или объекты клиентов (для завода).
// points: [{ id, lat, lng, kind: "plant" | "plant_off" | "client" | "client_mine",
//            title, subtitle, onClick }]
export default function PointsMap({ points, height = "40vh" }) {
  const valid = points.filter((p) => p.lat != null && p.lng != null);
  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
      <MapContainer center={ALMATY} zoom={11} style={{ height, width: "100%" }} scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <FitBounds points={valid} />
        {valid.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={ICONS[p.kind] || ICONS.client}>
            <Popup>
              <div style={{ minWidth: "150px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px" }}>{p.title}</div>
                {p.subtitle && (
                  <div style={{ color: "#666", fontSize: "12px", marginTop: 2 }}>{p.subtitle}</div>
                )}
                {p.onClick && (
                  <button
                    onClick={p.onClick}
                    style={{ marginTop: 6, fontSize: "12px", fontWeight: 700, color: "#2563eb", textDecoration: "underline" }}
                  >
                    {p.linkLabel || "→"}
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
