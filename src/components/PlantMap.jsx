import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Factory, Phone } from "lucide-react";

const PLANTS = [
  {
    name: "РБУ Запад",
    city: "Каскелен",
    coords: [43.2167, 76.6333],
    phone: "+7 700 000 00 01",
  },
  {
    name: "РБУ Восток",
    city: "Талгар",
    coords: [43.3, 77.0],
    phone: "+7 700 000 00 02",
  },
  {
    name: "РБУ Центр",
    city: "Рыскулова",
    coords: [43.2776, 76.9558],
    phone: "+7 700 000 00 03",
  },
];

const plantIcon = L.divIcon({
  className: "",
  html: `<div style="background:#fbbf24;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #171717;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:16px">🏭</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

export default function PlantMap() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
        <MapContainer
          center={[43.26, 76.8]}
          zoom={10}
          style={{ height: "55vh", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {PLANTS.map((p) => (
            <Marker key={p.name} position={p.coords} icon={plantIcon}>
              <Popup>
                <div style={{ minWidth: "160px" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>{p.name}</div>
                  <div style={{ color: "#666", fontSize: "12px" }}>г. {p.city}</div>
                  <div style={{ marginTop: "6px", fontSize: "12px" }}>{p.phone}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold text-neutral-900 px-1">Наши заводы-партнёры РБУ</h3>
        {PLANTS.map((p) => (
          <div
            key={p.name}
            className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Factory className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-neutral-900">{p.name}</div>
              <div className="text-sm text-neutral-500">г. {p.city}</div>
              <a
                href={`tel:${p.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold mt-2"
              >
                <Phone className="w-3.5 h-3.5" />
                {p.phone}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
