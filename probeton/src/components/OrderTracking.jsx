import React, { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { ORDER_STATUSES, STATUS_FLOW, normPhone } from "@/lib/orderStatuses";
import {
  Package,
  Truck,
  Loader2,
  Star,
  QrCode,
  CheckCircle2,
  Hourglass,
  Clock,
  MapPin,
  XCircle,
  Ban,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notifications";
const LiveDriverMap = lazy(() => import("@/components/LiveDriverMap"));

function Stars({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="active:scale-90 transition-transform"
        >
          <Star
            className={cn(
              "w-7 h-7",
              n <= value ? "fill-amber-400 text-amber-400" : "text-neutral-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function OrderCard({ o, busy, onPay, onRate, onCancel, ratePick, setRatePick, driverPhone }) {
  const navigate = useNavigate();
  const st = ORDER_STATUSES[o.status || "new"];
  const currentIdx = STATUS_FLOW.indexOf(o.status || "new");
  const isEnRoute = o.status === "en_route";
  const isDone = o.status === "done";
  const isCancelled = o.status === "cancelled";
  const isActive = !isDone && !isCancelled;
  const commission = (o.cubes || 0) * 1000;
  const material = o.total != null ? Math.max(o.total - commission, 0) : null;

  const fmtDate = (d) =>
    new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        isCancelled
          ? "border-red-200 bg-red-50"
          : isDone
          ? "border-neutral-300 bg-white"
          : isEnRoute
          ? "border-green-400 bg-green-50"
          : "border-neutral-200 bg-neutral-50"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-neutral-900">
          {o.order_number || "Заказ"}
        </span>
        <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", st.cls)}>
          {st.label}
        </span>
      </div>

      {isActive && (
        <button
          onClick={() => navigate(`/order/${o.id}`)}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white"
        >
          <MapPin className="w-4 h-4" />
          {o.driver_id ? "Смотреть на карте" : "Подробнее о заказе"}
        </button>
      )}

      {(o.grade || o.cubes || o.delivery_address || o.comment) && (
        <div className="text-xs text-neutral-600 space-y-1">
          {(o.grade || o.cubes) && (
            <div>
              {o.grade}
              {o.grade && o.cubes ? " · " : ""}
              {o.cubes ? `${o.cubes} куб` : ""}
            </div>
          )}
          {o.delivery_address && <div>Адрес: {o.delivery_address}</div>}
          {o.comment && <div className="italic">Комментарий: {o.comment}</div>}
        </div>
      )}

      {isActive && o.driver_id && (
        driverPhone ? (
          <a
            href={`tel:${driverPhone}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-green-600 rounded-lg px-3 py-2.5"
          >
            <Phone className="w-4 h-4" />
            Миксерист: {driverPhone}
          </a>
        ) : (
          <div className="text-xs text-neutral-400 text-center px-3 py-2 bg-neutral-100 rounded-lg">
            Загрузка номера миксериста...
          </div>
        )
      )}

      {isEnRoute && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-3 py-2.5">
            <Truck className="w-5 h-5" />
            <span className="font-bold text-sm">
              Миксер выехал — ожидайте подачи!
            </span>
          </div>
          {o.driver_id && (
            <Suspense
              fallback={
                <div className="h-[35vh] rounded-2xl bg-neutral-100 animate-pulse" />
              }
            >
              <LiveDriverMap driverIds={[o.driver_id]} height="35vh" />
            </Suspense>
          )}
        </div>
      )}

      {o.needed_by && (
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 bg-neutral-100 rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5" />
          Нужен к:{" "}
          {new Date(o.needed_by).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

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

      {isDone && (
        <div className="space-y-3 pt-1">
          <div className="rounded-xl border border-neutral-200 p-3 space-y-1">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
              Блок А · Оплата за материал водителю
            </div>
            <div className="text-lg font-black text-neutral-900">
              {material != null ? `${material.toLocaleString("ru-RU")} ₸` : "по договорённости"}
            </div>
            <div className="text-xs text-neutral-500">
              Переведите сумму напрямую водителю на Kaspi Gold или по его реквизитам.
            </div>
            {o.driver_name && (
              <div className="text-xs text-neutral-600">Водитель: {o.driver_name}</div>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              Блок Б · Сервисный сбор PROBETON
            </div>
            <div className="text-lg font-black text-neutral-900">
              {commission.toLocaleString("ru-RU")} ₸
            </div>
            <div className="text-[11px] text-neutral-500">{o.cubes || 0} куб × 1 000 ₸</div>

            <div className="flex flex-col items-center justify-center bg-white border border-dashed border-amber-300 rounded-lg p-4">
              <QrCode className="w-16 h-16 text-neutral-800" />
              <div className="text-[10px] text-neutral-500 mt-1">
                Kaspi QR — реквизиты PROBETON
              </div>
            </div>
            <div className="text-[10px] text-neutral-400 leading-snug">
              Оплачивая счёт, вы подтверждаете выполнение информационных услуг платформой в полном объёме.
            </div>

            {o.commission_paid ? (
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-green-600 bg-green-100 rounded-lg py-2">
                <CheckCircle2 className="w-4 h-4" />
                Оплата подтверждена
              </div>
            ) : o.client_paid ? (
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-600 bg-amber-100 rounded-lg py-2">
                <Hourglass className="w-4 h-4 animate-pulse" />
                Ожидает подтверждения диспетчером
              </div>
            ) : (
              <Button
                onClick={() => onPay(o.id)}
                disabled={busy === o.id}
                className="w-full bg-amber-400 hover:bg-amber-300 text-neutral-900 font-bold h-11"
              >
                {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Я оплатил"}
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
              Оцените водителя
            </div>
            {o.client_rating ? (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-xs text-neutral-500">
                  Ваша оценка: {o.client_rating}★
                </span>
              </div>
            ) : (
              <Stars
                value={ratePick[o.id] || 0}
                onChange={(n) => {
                  setRatePick((p) => ({ ...p, [o.id]: n }));
                  onRate(o.id, n);
                }}
              />
            )}
          </div>
        </div>
      )}

      {isActive && (
        <button
          onClick={() => onCancel(o.id)}
          disabled={busy === o.id}
          className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
        >
          <Ban className="w-3.5 h-3.5" />
          Отменить заказ
        </button>
      )}

      {!isDone && !isCancelled && (
        <div className="text-xs text-neutral-500">Создан: {fmtDate(o.created_date)}</div>
      )}
    </div>
  );
}

export default function OrderTracking() {
  const { user } = useAuth();
  const activePhone = normPhone(user?.phone);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [ratePick, setRatePick] = useState({});
  const [driverPhones, setDriverPhones] = useState({});

  const fetchMine = async (num) => {
    if (!num) return;
    setLoading(true);
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      const mine = all.filter((o) => normPhone(o.phone) === num);
      setOrders(mine);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activePhone) {
      setLoading(false);
      return;
    }
    fetchMine(activePhone);
     
  }, [activePhone]);

  useEffect(() => {
    if (!activePhone) return;
    const unsub = base44.entities.Order.subscribe((payload) => {
      fetchMine(activePhone);
      const wasFree = !payload?.old?.driver_id;
      const nowAssigned = !!payload?.new?.driver_id;
      const belongsToMe =
        payload?.new?.phone && normPhone(payload.new.phone) === activePhone;
      if (
        payload?.eventType === "UPDATE" &&
        wasFree &&
        nowAssigned &&
        belongsToMe
      ) {
        notify(
          "Заказ принят!",
          `Миксерист ${payload.new.driver_name || ""} принял ваш заказ`.trim()
        );
      }
    });
    return unsub;
  }, [activePhone]);

  useEffect(() => {
    const ids = [
      ...new Set(
        orders
          .filter((o) => o.status !== "done" && o.status !== "cancelled" && o.driver_id)
          .map((o) => o.driver_id)
      ),
    ];
    if (ids.length === 0) return;
    let mounted = true;
    supabase
      .from("app_users")
      .select("id, phone")
      .in("id", ids)
      .then(({ data }) => {
        if (!mounted || !data) return;
        setDriverPhones((prev) => {
          const next = { ...prev };
          data.forEach((u) => {
            next[u.id] = u.phone;
          });
          return next;
        });
      });
    return () => {
      mounted = false;
    };
  }, [orders]);

  const payDone = async (id) => {
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { client_paid: true });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const rateDriver = async (id, stars) => {
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { client_rating: stars });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const cancelOrder = async (id) => {
    if (!confirm("Отменить этот заказ? Действие нельзя будет вернуть.")) return;
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { status: "cancelled" });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const activeOrders = orders.filter(
    (o) => o.status !== "done" && o.status !== "cancelled"
  );
  const historyOrders = orders.filter(
    (o) => o.status === "done" || o.status === "cancelled"
  );

  return (
    <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
          <Truck className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900">Мой заказ</h2>
          <p className="text-xs text-neutral-500">
            Статус и оплата в реальном времени
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-neutral-400">
          <Package className="w-9 h-9 mx-auto mb-2 opacity-40" />
          <p className="text-sm">У вас пока нет заказов</p>
        </div>
      ) : null}

      {activeOrders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 px-1">
            {activeOrders.length === 1 ? "Активный заказ" : "Активные заказы"}
          </h3>
          <div className="space-y-3">
            {activeOrders.map((o) => (
              <OrderCard
                key={o.id}
                o={o}
                busy={busy}
                onPay={payDone}
                onRate={rateDriver}
                onCancel={cancelOrder}
                ratePick={ratePick}
                setRatePick={setRatePick}
                driverPhone={o.driver_id ? driverPhones[o.driver_id] : null}
              />
            ))}
          </div>
        </div>
      )}

      {historyOrders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 px-1">
            История заказов
          </h3>
          <div className="space-y-3">
            {historyOrders.map((o) => (
              <OrderCard
                key={o.id}
                o={o}
                busy={busy}
                onPay={payDone}
                onRate={rateDriver}
                onCancel={cancelOrder}
                ratePick={ratePick}
                setRatePick={setRatePick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
