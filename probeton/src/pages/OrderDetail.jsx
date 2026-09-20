import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { ORDER_STATUSES, STATUS_FLOW } from "@/lib/orderStatuses";
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  Clock,
  MessageSquare,
  Loader2,
  Truck,
  Ban,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LiveDriverMap = lazy(() => import("@/components/LiveDriverMap"));

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [driverPhone, setDriverPhone] = useState(null);

  const load = async () => {
    try {
      const o = await base44.entities.Order.get(id);
      if (!o) {
        setNotFound(true);
      } else {
        setOrder(o);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!order?.driver_id) {
      setDriverPhone(null);
      return;
    }
    let mounted = true;
    supabase
      .from("app_users")
      .select("phone")
      .eq("id", order.driver_id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setDriverPhone(data?.phone || null);
      });
    return () => {
      mounted = false;
    };
  }, [order?.driver_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="p-6 text-center text-neutral-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Заказ не найден</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-bold text-neutral-900 underline"
        >
          Назад
        </button>
      </div>
    );
  }

  const o = order;
  const st = ORDER_STATUSES[o.status || "new"];
  const currentIdx = STATUS_FLOW.indexOf(o.status || "new");
  const isDone = o.status === "done";
  const isCancelled = o.status === "cancelled";
  const isOrderActive = !isDone && !isCancelled;
  // Карта показывается для любого активного заказа с назначенным
  // водителем — не только когда миксер уже в пути.
  const hasDriverMap = isOrderActive && !!o.driver_id;

  const cancelOrder = async () => {
    if (!confirm("Отменить этот заказ? Действие нельзя будет вернуть.")) return;
    setCancelling(true);
    try {
      await base44.entities.Order.update(o.id, { status: "cancelled" });
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

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
        <h1 className="text-xl font-black text-neutral-900">
          {o.order_number || "Заказ"}
        </h1>
        <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold", st.cls)}>
          {st.label}
        </span>
      </div>

      {isCancelled ? (
        <div className="flex items-center gap-2 bg-red-100 text-red-700 rounded-lg px-3 py-2.5">
          <XCircle className="w-5 h-5" />
          <span className="font-bold text-sm">Заказ отменён</span>
        </div>
      ) : (
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
              {ORDER_STATUSES[s].label}
            </span>
          ))}
        </div>
      )}

      {hasDriverMap && (
        <div className="space-y-2">
          {o.status === "en_route" && (
            <div className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-3 py-2.5">
              <Truck className="w-5 h-5" />
              <span className="font-bold text-sm">
                Миксер выехал — ожидайте подачи!
              </span>
            </div>
          )}
          <Suspense
            fallback={
              <div className="h-[45vh] rounded-2xl bg-neutral-100 animate-pulse" />
            }
          >
            <LiveDriverMap driverIds={[o.driver_id]} height="45vh" />
          </Suspense>
          {o.driver_name && (
            <div className="text-xs text-neutral-500 text-center">
              Водитель: {o.driver_name}
            </div>
          )}
          {driverPhone && (
            <a
              href={`tel:${driverPhone}`}
              className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-green-600 rounded-lg px-3 py-2.5"
            >
              <Phone className="w-4 h-4" />
              Позвонить миксеристу: {driverPhone}
            </a>
          )}
        </div>
      )}

      {isOrderActive && !o.driver_id && (
        <div className="text-xs text-neutral-400 text-center px-3 py-2 bg-neutral-100 rounded-lg">
          Номер телефона миксериста появится здесь, как только он примет заказ
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Package className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
          <div className="text-sm text-neutral-800">
            <p className="font-medium leading-snug">{o.what_needed}</p>
            {(o.grade || o.cubes) && (
              <p className="text-xs text-neutral-500 mt-1">
                {o.grade}
                {o.grade && o.cubes ? " · " : ""}
                {o.cubes ? `${o.cubes} куб` : ""}
              </p>
            )}
          </div>
        </div>

        {o.delivery_address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="text-sm text-neutral-700">
              <p>{o.delivery_address}</p>
              {o.delivery_lat != null && o.delivery_lng != null && (
                <a
                  href={`https://www.google.com/maps?q=${o.delivery_lat},${o.delivery_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-blue-600 underline"
                >
                  Открыть точку на карте
                </a>
              )}
            </div>
          </div>
        )}

        {o.comment && (
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <p className="text-sm text-neutral-600 italic">{o.comment}</p>
          </div>
        )}

        {o.needed_by && (
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 bg-neutral-100 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5" />
            Нужен к: {fmtDate(o.needed_by)}
          </div>
        )}

        <a
          href={`tel:${o.phone}`}
          className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
        >
          <Phone className="w-4 h-4" />
          {o.phone}
        </a>

        <div className="text-xs text-neutral-400">
          Создан: {fmtDate(o.created_date)}
        </div>
      </div>

      {isOrderActive && (
        <button
          onClick={cancelOrder}
          disabled={cancelling}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {cancelling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Ban className="w-4 h-4" />
          )}
          Отменить заказ
        </button>
      )}
    </div>
  );
}
