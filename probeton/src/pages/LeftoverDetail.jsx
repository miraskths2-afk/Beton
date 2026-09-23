import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  Loader2,
  Flame,
  CheckCircle2,
  Inbox,
  Loader,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailPageSkeleton } from "@/components/Skeleton";

const StaticPointMap = lazy(() => import("@/components/StaticPointMap"));
const OrderRouteMap = lazy(() => import("@/components/OrderRouteMap"));

const STATUS = {
  available: { label: "Новый", icon: Inbox, cls: "bg-blue-100 text-blue-700" },
  intercepted: { label: "В работе", icon: Loader, cls: "bg-amber-100 text-amber-700" },
  gone: { label: "Выполнен", icon: CheckCircle2, cls: "bg-green-100 text-green-700" },
};
const STATUS_FLOW = ["available", "intercepted", "gone"];

export default function LeftoverDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const l = await base44.entities.Leftover.get(id);
      if (!l) setNotFound(true);
      else setItem(l);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Leftover.subscribe(() => load());
    return unsub;
     
  }, [id]);

  const canManage = user?.role === "admin" || user?.id === item?.driver_id;

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const extra = {};
      if (status === "intercepted" && !item.intercepted_at)
        extra.intercepted_at = new Date().toISOString();
      if (status === "gone") extra.completed_at = new Date().toISOString();
      await base44.entities.Leftover.update(id, { status, ...extra });
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Удалить этот остаток безвозвратно?")) return;
    setBusy(true);
    try {
      await base44.entities.Leftover.delete(id);
      navigate(-1);
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (notFound || !item) {
    return (
      <div className="p-6 text-center text-neutral-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Остаток не найден (возможно, уже удалён)</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-bold text-neutral-900 underline"
        >
          Назад
        </button>
      </div>
    );
  }

  const l = item;
  const st = STATUS[l.status] || STATUS.available;
  const StIcon = st.icon;
  const currentIdx = STATUS_FLOW.indexOf(l.status || "available");
  const hasInterceptPoint = l.intercepted_lat != null && l.intercepted_lng != null;

  const fmtDate = (d) =>
    new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          {l.grade} · {l.cubes} куб
        </h1>
        <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1", st.cls)}>
          <StIcon className="w-3.5 h-3.5" />
          {st.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FLOW.map((s, i) => (
          <span
            key={s}
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
              i <= currentIdx
                ? "bg-neutral-900 text-white"
                : "bg-neutral-200 text-neutral-400"
            )}
          >
            {STATUS[s].label}
          </span>
        ))}
      </div>

      {hasInterceptPoint && l.status === "intercepted" && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide px-1">
            Водитель и место, откуда перехватили
          </div>
          <Suspense
            fallback={
              <div className="h-[45vh] rounded-2xl bg-neutral-100 animate-pulse" />
            }
          >
            <OrderRouteMap
              driverId={l.driver_id}
              destination={{ lat: l.intercepted_lat, lng: l.intercepted_lng }}
              height="45vh"
            />
          </Suspense>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${l.intercepted_lat},${l.intercepted_lng}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
            >
              Google Maps
            </a>
            <a
              href={`https://2gis.kz/directions/points/%7C${l.intercepted_lng},${l.intercepted_lat}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
            >
              2ГИС
            </a>
          </div>
        </div>
      )}

      {hasInterceptPoint && l.status !== "intercepted" && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide px-1">
            Место, откуда перехватили
          </div>
          <Suspense
            fallback={
              <div className="h-[28vh] rounded-2xl bg-neutral-100 animate-pulse" />
            }
          >
            <StaticPointMap
              lat={l.intercepted_lat}
              lng={l.intercepted_lng}
              label={l.intercepted_by_phone}
              height="28vh"
            />
          </Suspense>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
          <p className="text-sm text-neutral-700">{l.direction}</p>
        </div>

        <div className="text-2xl font-black text-orange-600">
          {l.price?.toLocaleString("ru-RU")} ₸
        </div>

        {l.driver_name && (
          <div className="text-sm text-neutral-600">
            Водитель: <span className="font-semibold">{l.driver_name}</span>
          </div>
        )}

        {l.phone && (
          <a
            href={`tel:${l.phone}`}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
          >
            <Phone className="w-4 h-4" />
            {l.phone}
          </a>
        )}

        {l.intercepted_by_phone && (
          <a
            href={`tel:${l.intercepted_by_phone}`}
            className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 rounded-lg px-3 py-2"
          >
            <Phone className="w-4 h-4" />
            Перехватил: {l.intercepted_by_phone}
          </a>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
          История действий
        </div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 mt-1" />
              {(l.intercepted_at || l.completed_at) && (
                <div className="w-px flex-1 bg-neutral-200 my-1" />
              )}
            </div>
            <div className="pb-1">
              <div className="text-sm font-semibold text-neutral-800">
                Остаток опубликован
              </div>
              <div className="text-xs text-neutral-400">
                {fmtDate(l.created_date)}
              </div>
            </div>
          </div>

          {l.intercepted_at && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1" />
                {l.completed_at && (
                  <div className="w-px flex-1 bg-neutral-200 my-1" />
                )}
              </div>
              <div className="pb-1">
                <div className="text-sm font-semibold text-neutral-800">
                  Перехвачен прорабом
                  {l.intercepted_by_phone ? ` — ${l.intercepted_by_phone}` : ""}
                </div>
                <div className="text-xs text-neutral-400">
                  {fmtDate(l.intercepted_at)}
                </div>
              </div>
            </div>
          )}

          {l.completed_at && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-green-600 mt-1" />
              </div>
              <div className="pb-1">
                <div className="text-sm font-semibold text-neutral-800">
                  Остаток забрали
                </div>
                <div className="text-xs text-neutral-400">
                  {fmtDate(l.completed_at)}
                </div>
              </div>
            </div>
          )}

          {!l.intercepted_at && !l.completed_at && (
            <div className="text-xs text-neutral-400 pl-5">
              Пока никто не перехватил этот остаток
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">
            Управление
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setStatus("available")}
              disabled={busy || l.status === "available"}
              className="text-xs font-bold py-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              Новый
            </button>
            <button
              onClick={() => setStatus("intercepted")}
              disabled={busy || l.status === "intercepted"}
              className="text-xs font-bold py-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40"
            >
              В работе
            </button>
            <button
              onClick={() => setStatus("gone")}
              disabled={busy || l.status === "gone"}
              className="text-xs font-bold py-2.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40"
            >
              Выполнен
            </button>
          </div>
          <button
            onClick={remove}
            disabled={busy}
            className="w-full text-xs font-bold py-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Удалить остаток
          </button>
        </div>
      )}
    </div>
  );
}
