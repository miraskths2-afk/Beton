import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Factory, Loader2, MapPin, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatPrice, hasPlantPoint, plantIcon, supplierName, supplierProducts } from "@/lib/suppliers";
import { t } from "@/lib/i18n";

const ALMATY = [43.238, 76.945];

const STATUS = {
  approved: { label: "Одобрен", cls: "bg-green-100 text-green-700" },
  rejected: { label: "Отклонён", cls: "bg-red-100 text-red-700" },
  pending: { label: "На одобрении", cls: "bg-amber-100 text-amber-700" },
};

// Вкладка «Поставщики» на странице «Партнёры» у админа: все заводы-
// поставщики на карте и списком. Одобряются они там же, где водители, —
// на Главной в «Заявках на одобрение».
export default function AdminSuppliersTab() {
  const [suppliers, setSuppliers] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const all = await base44.entities.User.list();
        if (mounted) setSuppliers(all.filter((u) => u.account_type === "supplier"));
      } catch (e) {
        console.error(e);
        if (mounted) setSuppliers([]);
      }
    };
    load();
    const unsub = base44.entities.User.subscribe(load);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const onMap = (suppliers || []).filter(hasPlantPoint);
  const center = onMap[0] ? [onMap[0].supplier_lat, onMap[0].supplier_lng] : ALMATY;

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">{t("Поставщики")}</h1>
        <p className="text-sm text-neutral-500">
          {t("Заводы, где миксеристы загружают бетон. Заявок и клиентов поставщики не видят.")}
        </p>
      </div>
      {suppliers === null ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
            <MapContainer center={center} zoom={10} style={{ height: "40vh", width: "100%" }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap"
              />
              {onMap.map((s) => (
                <Marker key={s.id} position={[s.supplier_lat, s.supplier_lng]} icon={plantIcon()}>
                  <Popup>
                    <div style={{ fontWeight: 700 }}>{supplierName(s)}</div>
                    <div style={{ fontSize: "12px" }}>
                      {supplierProducts(s).map((p) => p.grade).join(", ")}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          {suppliers.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
              {t("Пока нет ни одного поставщика")}
            </div>
          ) : (
            <div className="space-y-2">
              {suppliers.map((s) => {
                const st = STATUS[s.approval_status] || STATUS.pending;
                return (
                  <div key={s.id} className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-neutral-900 flex items-center gap-1.5 min-w-0">
                        <Factory className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">{supplierName(s)}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${st.cls}`}>
                        {t(st.label)}
                      </span>
                    </div>
                    {s.full_name && s.supplier_company && (
                      <div className="text-xs text-neutral-500">{s.full_name}</div>
                    )}
                    <div className="text-xs text-neutral-600 flex items-start gap-1">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                      {hasPlantPoint(s) ? s.supplier_address || t("Точка на карте отмечена") : t("Завод на карте не отмечен")}
                    </div>
                    {supplierProducts(s).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {supplierProducts(s).map((p) => (
                          <span key={p.grade} className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-[11px] text-neutral-700">
                            {p.grade} · {formatPrice(p.price)}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Phone className="w-3 h-3" />
                        {s.phone}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
