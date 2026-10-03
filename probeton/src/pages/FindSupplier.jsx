import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Factory, Loader2, MapPin, Navigation, Phone } from "lucide-react";
import { supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import { fetchLocations } from "@/lib/driverLocation";
import { vehicleIcon } from "@/lib/mapIcons";
import { distanceKm, formatKm } from "@/lib/geo";
import {
  SUPPLIER_GRADES,
  fetchSuppliers,
  formatPrice,
  isMissingSupplierSql,
  orderGrade,
  plantIcon,
  supplierName,
  supplierProducts,
} from "@/lib/suppliers";
import { t } from "@/lib/i18n";

const ALMATY = [43.238, 76.945];
const OPEN = ["in_progress", "sent_to_plant", "manufacturing", "en_route"];

// «Где загрузиться»: миксерист, взявший заявку, указывает нужную марку
// бетона и видит поставщиков (заводы), у которых она есть, — на карте и
// списком, ближайшие сверху. Поставщику при этом ничего о заявке
// не передаётся: куда едет миксерист, он не знает.
export default function FindSupplier() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  const [myOrders, setMyOrders] = useState(null);
  const [grade, setGrade] = useState("");
  const [suppliers, setSuppliers] = useState(null);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      const [ordersRes, locs] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, grade, what_needed, status, service_type")
          .eq("driver_id", user.id)
          .in("status", OPEN),
        fetchLocations([user.id]),
      ]);
      if (!mounted) return;
      const list = (ordersRes.data || []).filter((o) => o.service_type !== "pump");
      setMyOrders(list);
      const wanted = list.find((o) => o.id === params.get("order")) || list[0];
      setGrade((g) => g || orderGrade(wanted) || "М300");
      if (locs[0]) setMe([locs[0].lat, locs[0].lng]);
    })();
    try {
      navigator.geolocation?.getCurrentPosition(
        (p) => mounted && setMe([p.coords.latitude, p.coords.longitude]),
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    } catch {
      // без геолокации — просто без расстояний
    }
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    fetchSuppliers()
      .then((list) => mounted && setSuppliers(list))
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setSuppliers([]);
        setError(
          isMissingSupplierSql(err)
            ? t("Поставщики ещё не подключены в базе. Сообщите диспетчеру.")
            : t("Не удалось загрузить поставщиков")
        );
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (role !== "driver") return <Navigate to="/" replace />;

  const isAdmin = user?.role === "admin";
  const allowed = isAdmin || (myOrders && myOrders.length > 0);

  const withGrade = (suppliers || [])
    .map((s) => {
      const product = supplierProducts(s).find((p) => p.grade === grade);
      return {
        ...s,
        product,
        km: me ? distanceKm(me[0], me[1], s.supplier_lat, s.supplier_lng) : null,
      };
    })
    .filter((s) => s.product)
    .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  const selected = withGrade.find((s) => s.id === selectedId);
  const center = me || (withGrade[0] ? [withGrade[0].supplier_lat, withGrade[0].supplier_lng] : ALMATY);

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-neutral-500 font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("Назад")}
      </button>
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
          <Factory className="w-5 h-5 text-indigo-600" />
          {t("Где загрузить бетон")}
        </h1>
        <p className="text-sm text-neutral-500">
          {t("Выберите марку — покажем заводы-поставщики, у которых она есть, ближайшие сверху")}
        </p>
      </div>

      {myOrders === null || suppliers === null ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : !allowed ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          {t("Искать поставщиков можно, когда вы взяли заявку")}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {SUPPLIER_GRADES.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGrade(g);
                  setSelectedId(null);
                }}
                className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                  grade === g
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-700 border-neutral-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 px-1">{error}</p>}

          <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
            <MapContainer
              key={center.join(",")}
              center={center}
              zoom={11}
              style={{ height: "40vh", width: "100%" }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap"
              />
              {me && (
                <Marker position={me} icon={vehicleIcon(true)}>
                  <Popup>{t("Вы здесь")}</Popup>
                </Marker>
              )}
              {withGrade.map((s) => (
                <Marker
                  key={s.id}
                  position={[s.supplier_lat, s.supplier_lng]}
                  icon={plantIcon(s.id === selectedId)}
                  eventHandlers={{ click: () => setSelectedId(s.id) }}
                >
                  <Popup>
                    <div style={{ fontWeight: 700 }}>{supplierName(s)}</div>
                    <div style={{ fontSize: "12px" }}>
                      {grade} · {formatPrice(s.product.price)}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {withGrade.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
              {t("Пока нет поставщиков с маркой {grade}", { grade })}
            </div>
          ) : (
            <div className="space-y-2">
              {(selected ? [selected, ...withGrade.filter((s) => s.id !== selectedId)] : withGrade).map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`bg-white rounded-2xl p-4 border shadow-sm space-y-2 ${
                    s.id === selectedId ? "border-amber-400" : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-black text-neutral-900">{supplierName(s)}</div>
                      {s.supplier_address && (
                        <div className="text-xs text-neutral-500 flex items-start gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{s.supplier_address}</span>
                        </div>
                      )}
                    </div>
                    {s.km != null && (
                      <span className="text-xs font-bold text-neutral-600 shrink-0">{formatKm(s.km)}</span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="font-bold">{grade}</span>
                    <span className="text-neutral-600"> · {formatPrice(s.product.price)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {supplierProducts(s)
                      .filter((p) => p.grade !== grade)
                      .map((p) => (
                        <span key={p.grade} className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-[11px] text-neutral-600">
                          {p.grade}
                        </span>
                      ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center gap-1 text-xs font-bold py-2.5 rounded-lg bg-neutral-900 text-white"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {t("Позвонить")}
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.supplier_lat},${s.supplier_lng}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-1 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Google
                    </a>
                    <a
                      href={`https://2gis.kz/directions/points/%7C${s.supplier_lng},${s.supplier_lat}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-1 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      2ГИС
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
