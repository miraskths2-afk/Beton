import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
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
  Trash2,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailPageSkeleton } from "@/components/Skeleton";
import { t, locale } from "@/lib/i18n";

const OrderRouteMap = lazy(() => import("@/components/OrderRouteMap"));
const StaticPointMap = lazy(() => import("@/components/StaticPointMap"));
const OrderChat = lazy(() => import("@/components/OrderChat"));

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [driverPhone, setDriverPhone] = useState(null);
  const [driverPhoto, setDriverPhoto] = useState(null);

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
     
  }, [id]);

  useEffect(() => {
    if (!order?.driver_id) {
      setDriverPhone(null);
      setDriverPhoto(null);
      return;
    }
    let mounted = true;
    supabase
      .from("app_users")
      .select("phone, photo_url")
      .eq("id", order.driver_id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) {
          setDriverPhone(data?.phone || null);
          setDriverPhoto(data?.photo_url || null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [order?.driver_id]);

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (notFound || !order) {
    return (
      <div className="p-6 text-center text-neutral-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{t("Заказ не найден")}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-bold text-neutral-900 underline"
        >
          {t("Назад")}
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
  const hasDeliveryPoint = o.delivery_lat != null && o.delivery_lng != null;
  // Прямая смена статуса и удаление — только у настоящего админа.
  // Сам водитель завершает заказ через оплату (см. кнопку ниже),
  // а не напрямую — иначе можно было бы обойти проверку оплаты.
  const canManage = user?.role === "admin";

  const cancelOrder = async () => {
    if (!confirm(t("Отменить этот заказ? Действие нельзя будет вернуть."))) return;
    setCancelling(true);
    try {
      await base44.entities.Order.update(o.id, { status: "cancelled" });
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const extra = {};
      if (status === "in_progress" && !o.accepted_at)
        extra.accepted_at = new Date().toISOString();
      if (status === "done") extra.completed_at = new Date().toISOString();
      await base44.entities.Order.update(o.id, { status, ...extra });
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const removeOrder = async () => {
    if (!confirm(t("Удалить эту заявку безвозвратно?"))) return;
    setBusy(true);
    try {
      await base44.entities.Order.delete(o.id);
      navigate(-1);
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  };

  const fmtDate = (d) =>
    new Date(d).toLocaleString(locale(), {
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
        {t("Назад")}
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-neutral-900">
          {o.order_number || t("Заказ")}
        </h1>
        <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold", st.cls)}>
          {t(st.label)}
        </span>
      </div>

      {isCancelled ? (
        <div className="flex items-center gap-2 bg-red-100 text-red-700 rounded-lg px-3 py-2.5">
          <XCircle className="w-5 h-5" />
          <span className="font-bold text-sm">{t("Заказ отменён")}</span>
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
              {t(ORDER_STATUSES[s].label)}
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
                {t("Миксер выехал — ожидайте подачи!")}
              </span>
            </div>
          )}
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide px-1">
            {t("Миксерист и маршрут до объекта")}
          </div>
          <Suspense
            fallback={
              <div className="h-[45vh] rounded-2xl bg-neutral-100 animate-pulse" />
            }
          >
            <OrderRouteMap
              driverId={o.driver_id}
              destination={
                hasDeliveryPoint
                  ? { lat: o.delivery_lat, lng: o.delivery_lng }
                  : null
              }
              height="45vh"
            />
          </Suspense>
          {o.driver_name && (
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
              {driverPhoto ? (
                <img
                  src={driverPhoto}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <UserCircle className="w-5 h-5 text-neutral-300" />
              )}
              {t("Водитель: {name}", { name: o.driver_name })}
            </div>
          )}
          {driverPhone && (
            <a
              href={`tel:${driverPhone}`}
              className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-green-600 rounded-lg px-3 py-2.5"
            >
              <Phone className="w-4 h-4" />
              {t("Позвонить миксеристу: {phone}", { phone: driverPhone })}
            </a>
          )}
        </div>
      )}

      {isOrderActive && !o.driver_id && (
        <div className="text-xs text-neutral-400 text-center px-3 py-2 bg-neutral-100 rounded-lg">
          {t("Номер телефона миксериста появится здесь, как только он примет заказ")}
        </div>
      )}

      {!hasDriverMap && hasDeliveryPoint && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide px-1">
            {t("Место доставки")}
          </div>
          <Suspense
            fallback={
              <div className="h-[28vh] rounded-2xl bg-neutral-100 animate-pulse" />
            }
          >
            <StaticPointMap
              lat={o.delivery_lat}
              lng={o.delivery_lng}
              label={o.delivery_address}
              height="28vh"
            />
          </Suspense>
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
                {o.cubes ? t("{n} куб", { n: o.cubes }) : ""}
              </p>
            )}
          </div>
        </div>

        {o.delivery_address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="text-sm text-neutral-700">
              <p>{o.delivery_address}</p>
              {hasDeliveryPoint && (
                <a
                  href={`https://www.google.com/maps?q=${o.delivery_lat},${o.delivery_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-blue-600 underline"
                >
                  {t("Открыть точку в Google Maps")}
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
            {t("Нужен к: {date}", { date: fmtDate(o.needed_by) })}
          </div>
        )}

        <a
          href={`tel:${o.phone}`}
          className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
        >
          <Phone className="w-4 h-4" />
          {o.phone}
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
          {t("История действий")}
        </div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 mt-1" />
              {(o.accepted_at || o.completed_at) && (
                <div className="w-px flex-1 bg-neutral-200 my-1" />
              )}
            </div>
            <div className="pb-1">
              <div className="text-sm font-semibold text-neutral-800">
                {t("Заявка создана")}
              </div>
              <div className="text-xs text-neutral-400">
                {fmtDate(o.created_date)}
              </div>
            </div>
          </div>

          {o.accepted_at && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1" />
                {o.completed_at && (
                  <div className="w-px flex-1 bg-neutral-200 my-1" />
                )}
              </div>
              <div className="pb-1">
                <div className="text-sm font-semibold text-neutral-800">
                  {t("Миксерист принял заказ")}
                  {o.driver_name ? ` — ${o.driver_name}` : ""}
                </div>
                <div className="text-xs text-neutral-400">
                  {fmtDate(o.accepted_at)}
                </div>
              </div>
            </div>
          )}

          {o.completed_at && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-green-600 mt-1" />
              </div>
              <div className="pb-1">
                <div className="text-sm font-semibold text-neutral-800">
                  {t("Заказ выполнен")}
                </div>
                <div className="text-xs text-neutral-400">
                  {fmtDate(o.completed_at)}
                </div>
              </div>
            </div>
          )}

          {!o.accepted_at && !o.completed_at && (
            <div className="text-xs text-neutral-400 pl-5">
              {t("Пока заказ ещё не принят миксеристом")}
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">
            {t("Управление")}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_FLOW.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                disabled={busy || o.status === s}
                className="text-[11px] font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
              >
                {t(ORDER_STATUSES[s].label)}
              </button>
            ))}
          </div>
          <button
            onClick={removeOrder}
            disabled={busy}
            className="w-full text-xs font-bold py-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {t("Удалить заявку")}
          </button>
        </div>
      )}

      {o.driver_id && (
        <Suspense
          fallback={<div className="h-40 rounded-2xl bg-neutral-100 animate-pulse" />}
        >
          <OrderChat
            orderId={o.id}
            myRole={user?.role === "admin" ? "admin" : user?.id === o.driver_id ? "driver" : "client"}
            myName={
              user?.role === "admin"
                ? "Диспетчер"
                : user?.id === o.driver_id
                ? user?.full_name || "Миксерист"
                : user?.full_name || "Заказчик"
            }
          />
        </Suspense>
      )}

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
          {t("Отменить заказ")}
        </button>
      )}
    </div>
  );
}
