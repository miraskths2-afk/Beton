import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Inbox,
  Package,
  MapPin,
  Phone,
  CheckCircle2,
  Loader2,
  Clock,
  Hourglass,
  Truck,
  Star,
  Flag,
  Headphones,
  Ban,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notifications";

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

export default function DriverHome() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [ratePick, setRatePick] = useState({});

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      setOrders(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe((payload) => {
      load();
      if (
        user?.notifications_enabled !== false &&
        payload?.eventType === "INSERT" &&
        (payload.new?.status || "new") === "new"
      ) {
        notify(
          "Новая заявка!",
          payload.new?.what_needed || "Появился новый заказ на бетон"
        );
      }
    });
    return unsub;
     
  }, [user?.notifications_enabled]);

  // Проверка одобрения теперь общая для всех ролей — в ProtectedRoute.

  const free = orders.filter((o) => (o.status || "new") === "new" && !o.driver_id);
  const active = orders.filter(
    (o) => o.driver_id === user?.id && o.status === "in_progress"
  );
  const completed = orders.filter(
    (o) => o.driver_id === user?.id && o.status === "done"
  );
  // Пока у водителя есть незавершённый заказ (не оплачен или ждёт
  // подтверждения менеджера) — новые заявки принимать нельзя.
  const hasUnfinishedOrder = orders.some(
    (o) => o.driver_id === user?.id && o.status !== "done"
  );

  const accept = async (o) => {
    if (hasUnfinishedOrder) {
      alert("Сначала завершите и оплатите текущий заказ — новые заявки пока недоступны.");
      return;
    }
    setBusy(o.id);
    try {
      await base44.entities.Order.update(o.id, {
        driver_id: user.id,
        driver_name: user.full_name || user.driver_name || user.phone || "Водитель",
        status: "in_progress",
        accepted_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const payCommission = async (id) => {
    if (!confirm("Подтвердите, что оплатили сервисный сбор PROBETON. После этого менеджер проверит оплату и завершит заказ.")) return;
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { driver_paid: true });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const rateClient = async (id, stars) => {
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { driver_rating: stars });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const complain = async (o) => {
    if (!confirm("Подать жалобу на прораба и внести номер в чёрный список?")) return;
    setBusy(o.id);
    try {
      await base44.entities.Blacklist.create({
        phone: o.phone,
        reason: "Неоплата от прораба",
      });
      alert("Жалоба отправлена. Диспетчер рассмотрит обращение.");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
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
    <div className="p-4 space-y-5">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">
          Здравствуйте, {user?.full_name || "партнёр"}
        </h1>
        <p className="text-sm text-neutral-500">
          Биржа бетона — первый взявший заказ забирает его
        </p>
      </div>

      {active.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
            Мои заказы в работе ({active.length})
          </div>
          {active.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                  <Truck className="w-3 h-3" /> В процессе
                </span>
                <span className="text-xs text-neutral-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDate(o.created_date)}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                <p className="text-sm text-neutral-800 font-medium leading-snug">
                  {o.what_needed}
                </p>
              </div>
              {o.delivery_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-neutral-600">
                    {o.delivery_address}
                    {o.delivery_lat != null && o.delivery_lng != null && (
                      <a
                        href={`https://www.google.com/maps?q=${o.delivery_lat},${o.delivery_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 underline font-semibold"
                      >
                        на карте
                      </a>
                    )}
                  </p>
                </div>
              )}
              {o.delivery_lat != null && o.delivery_lng != null && (
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Google Maps
                  </a>
                  <a
                    href={`https://2gis.kz/directions/points/%7C${o.delivery_lng},${o.delivery_lat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    2ГИС
                  </a>
                </div>
              )}
              <a
                href={`tel:${o.phone}`}
                className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
              >
                <Phone className="w-4 h-4" />
                Клиент: {o.phone}
              </a>
              {o.driver_payment_confirmed ? (
                <div className="w-full text-xs font-bold py-2.5 rounded-lg bg-green-100 text-green-700 inline-flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Оплата подтверждена — завершается
                </div>
              ) : o.driver_paid ? (
                <div className="w-full text-xs font-bold py-2.5 rounded-lg bg-amber-100 text-amber-700 inline-flex items-center justify-center gap-1">
                  <Hourglass className="w-4 h-4 animate-pulse" />
                  Ожидает подтверждения менеджером
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-center">
                    <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Сервисный сбор PROBETON
                    </div>
                    <div className="text-lg font-black text-neutral-900">
                      {((o.cubes || 0) * 1000).toLocaleString("ru-RU")} ₸
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {o.cubes || 0} куб × 1 000 ₸ · оплата на Kaspi PROBETON
                    </div>
                  </div>
                  <button
                    onClick={() => payCommission(o.id)}
                    disabled={busy === o.id}
                    className="w-full text-xs font-bold py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                  >
                    {busy === o.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Я оплатил — завершить заказ
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
            Завершённые ({completed.length})
          </div>
          {completed.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-600">
                  <CheckCircle2 className="w-3 h-3" /> Доставлено
                </span>
                {o.commission_paid ? (
                  <span className="text-xs font-bold text-green-600">Оплачено</span>
                ) : o.client_paid ? (
                  <span className="text-xs font-bold text-amber-600">
                    Ожидает оплаты сбора
                  </span>
                ) : (
                  <span className="text-xs font-bold text-neutral-400">
                    Ждём оплату клиента
                  </span>
                )}
              </div>
              <div className="text-sm text-neutral-700 font-medium">
                {o.what_needed}
              </div>
              {o.driver_rating ? (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-neutral-500">
                    Вы оценили клиента: {o.driver_rating}★
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-xs text-neutral-500">Оцените клиента:</div>
                  <Stars
                    value={ratePick[o.id] || 0}
                    onChange={(n) => {
                      setRatePick((p) => ({ ...p, [o.id]: n }));
                      rateClient(o.id, n);
                    }}
                  />
                </div>
              )}
              <button
                onClick={() => complain(o)}
                disabled={busy === o.id}
                className="w-full text-xs font-bold py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center gap-1"
              >
                <Flag className="w-3.5 h-3.5" />
                Жалоба: клиент не оплатил
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
        Свободные заказы ({free.length})
      </div>

      {hasUnfinishedOrder && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-xs font-semibold">
          <Ban className="w-4 h-4 shrink-0" />
          У вас есть незавершённый заказ — заверьте оплату и дождитесь
          подтверждения менеджера, чтобы принимать новые заявки.
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Загрузка...
        </div>
      ) : free.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Пока нет свободных заказов</p>
          <p className="text-xs mt-1">Новые заявки появятся здесь автоматически</p>
        </div>
      ) : (
        <div className="space-y-3">
          {free.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">
                  <Inbox className="w-3 h-3" /> Поиск машины
                </span>
                <span className="text-xs text-neutral-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDate(o.created_date)}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                <p className="text-sm text-neutral-800 font-medium leading-snug">
                  {o.what_needed}
                </p>
              </div>
              {o.grade && (
                <div className="text-xs text-neutral-500 pl-6">
                  {o.grade}
                  {o.cubes ? ` · ${o.cubes} куб` : ""}
                </div>
              )}
              {o.delivery_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-neutral-600">
                    {o.delivery_address}
                    {o.delivery_lat != null && o.delivery_lng != null && (
                      <a
                        href={`https://www.google.com/maps?q=${o.delivery_lat},${o.delivery_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 text-blue-600 underline font-semibold"
                      >
                        на карте
                      </a>
                    )}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
                <Headphones className="w-3.5 h-3.5 text-neutral-400" />
                Контакты скрыты — связь через диспетчера
              </div>
              <button
                onClick={() => accept(o)}
                disabled={busy === o.id || hasUnfinishedOrder}
                className="w-full text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
              >
                {busy === o.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : hasUnfinishedOrder ? (
                  <>
                    <Ban className="w-4 h-4" />
                    Сначала завершите текущий заказ
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    Готов выехать — взять заказ
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
