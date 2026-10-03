import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Factory, Phone, Truck, Loader2, ChevronRight } from "lucide-react";
import { supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { fetchLocations, subscribeToLocations } from "@/lib/driverLocation";
import { vehicleIcon } from "@/lib/mapIcons";
import { hasPlantPoint, plantIcon, supplierName, supplierProducts } from "@/lib/suppliers";
import { distanceKm, formatKm } from "@/lib/geo";
import { t } from "@/lib/i18n";

const ALMATY = [43.238, 76.945];

// Статусы, при которых миксерист «на задании» (везёт чью-то заявку).
const ON_JOB = ["in_progress", "sent_to_plant", "manufacturing", "en_route"];

// Главная поставщика: миксеристы на линии, те, кто на задании, выделены.
// Поставщику НЕ показываем ни заявок, ни клиентов, ни адресов доставки —
// из заказов берём только «чей» и «какой статус».
export default function SupplierHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mixers, setMixers] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const locs = await fetchLocations();
        const ids = locs.map((l) => l.driver_id);
        if (ids.length === 0) {
          if (mounted) setMixers([]);
          return;
        }
        const [{ data: users }, { data: jobs }] = await Promise.all([
          supabase
            .from("app_users")
            .select("id, role, account_type, full_name, phone, vehicle_plate")
            .in("id", ids),
          supabase.from("orders").select("driver_id, status").in("driver_id", ids).in("status", ON_JOB),
        ]);
        const busy = new Set((jobs || []).map((j) => j.driver_id));
        const list = locs
          .map((l) => {
            const u = (users || []).find((x) => x.id === l.driver_id);
            return { ...l, user: u, onJob: busy.has(l.driver_id) };
          })
          // Только миксеристы (админ в режиме «Водитель» — тоже, для проверки).
          .filter((m) => m.user && (m.user.account_type === "driver" || m.user.role === "admin"));
        if (mounted) setMixers(list);
      } catch (e) {
        console.error(e);
        if (mounted) setMixers([]);
      }
    };
    load();
    const unsub = subscribeToLocations(load);
    const ch = supabase
      .channel(`realtime:supplier_orders:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => {
      mounted = false;
      unsub();
      supabase.removeChannel(ch);
    };
  }, []);

  const hasPlant = hasPlantPoint(user);
  const plant = hasPlant ? [user.supplier_lat, user.supplier_lng] : null;
  const center = plant || (mixers?.[0] ? [mixers[0].lat, mixers[0].lng] : ALMATY);
  const sorted = (mixers || [])
    .map((m) => ({
      ...m,
      km: plant ? distanceKm(plant[0], plant[1], m.lat, m.lng) : null,
    }))
    .sort((a, b) => Number(b.onJob) - Number(a.onJob) || (a.km ?? 1e9) - (b.km ?? 1e9));
  const onJobCount = sorted.filter((m) => m.onJob).length;
  const noProducts = supplierProducts(user).length === 0;

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">
          {t("Здравствуйте, {name}", { name: supplierName(user) })}
        </h1>
        <p className="text-sm text-neutral-500">
          {t("Миксеристы на линии. Оранжевые — на задании, могут приехать к вам за бетоном.")}
        </p>
      </div>

      {(!hasPlant || noProducts) && (
        <button
          onClick={() => navigate("/my-plant")}
          className="w-full text-left bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-3"
        >
          <Factory className="w-6 h-6 text-indigo-600 shrink-0" />
          <div className="flex-1 text-sm text-indigo-900 font-semibold">
            {t("Отметьте завод на карте и укажите, какой бетон продаёте — иначе миксеристы вас не найдут.")}
          </div>
          <ChevronRight className="w-5 h-5 text-indigo-400" />
        </button>
      )}

      {mixers === null ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
            <MapContainer center={center} zoom={11} style={{ height: "45vh", width: "100%" }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap"
              />
              {plant && (
                <Marker position={plant} icon={plantIcon()}>
                  <Popup>{t("Ваш завод")}</Popup>
                </Marker>
              )}
              {sorted.map((m) => (
                <Marker key={m.driver_id} position={[m.lat, m.lng]} icon={vehicleIcon(m.onJob)}>
                  <Popup>
                    <div style={{ minWidth: "140px" }}>
                      <div style={{ fontWeight: 700 }}>{m.user?.full_name || m.driver_name || t("Миксерист")}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {m.onJob ? t("На задании") : t("Свободен")}
                        {m.km != null ? ` · ${formatKm(m.km)}` : ""}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="flex gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
              {t("На задании: {n}", { n: onJobCount })}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-800">
              {t("Свободны: {n}", { n: sorted.length - onJobCount })}
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
              {t("Сейчас нет миксеристов на линии")}
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((m) => (
                <div
                  key={m.driver_id}
                  className={`bg-white rounded-2xl p-3 border shadow-sm flex items-center gap-3 ${
                    m.onJob ? "border-amber-300" : "border-neutral-200"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      m.onJob ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-neutral-900 truncate">
                      {m.user?.full_name || m.driver_name || t("Миксерист")}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {m.onJob ? t("На задании") : t("Свободен")}
                      {m.user?.vehicle_plate ? ` · ${m.user.vehicle_plate}` : ""}
                      {m.km != null ? ` · ${t("до завода {km}", { km: formatKm(m.km) })}` : ""}
                    </div>
                  </div>
                  {m.user?.phone && (
                    <a
                      href={`tel:${m.user.phone}`}
                      className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0"
                      aria-label={t("Позвонить")}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
