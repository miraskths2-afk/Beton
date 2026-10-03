import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ORDER_STATUSES,
  normPhone,
  canClientCancel,
  statusLabel,
} from "@/lib/orderStatuses";
import {
  isPumpOrder,
  workerLabel,
  pumpPrepay,
  pumpFinalTotal,
  pumpErrorText,
  PUMP_MIN_HOURS,
} from "@/lib/pump";
import { formatTenge } from "@/lib/balance";
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
  Repeat,
  Construction,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notifications";
import { cancelOrderAsClient } from "@/lib/warnings";
import { t, locale } from "@/lib/i18n";
import ChatButton from "@/components/ChatButton";
import OrderExtras from "@/components/OrderExtras";
import DowntimeTimer from "@/components/DowntimeTimer";
import PumpWorkTimer from "@/components/PumpWorkTimer";
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

// Предоплата АБН: клиент платит сразу за заказанные часы (минимум 3).
function PumpPayment({ o, busy, onPrepay }) {
  const prepay = pumpPrepay(o);
  const hours = Math.max(PUMP_MIN_HOURS, Number(o.pump_hours || 0));
  const isDone = o.status === "done" || !!o.unloaded_at;
  const finalTotal = pumpFinalTotal(o);
  const extra = isDone && finalTotal != null && prepay != null ? Math.max(0, finalTotal - prepay) : 0;
  const payee = t("насоснику");
  const someoneTook = !!o.driver_id;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
      <div className="text-xs font-bold text-sky-800 uppercase tracking-wide">
        {t("Оплата АБН · почасовая")}
      </div>
      <div className="text-lg font-black text-neutral-900">
        {prepay != null ? formatTenge(prepay) : t("Цена уточняется")}
      </div>
      <div className="text-[11px] text-neutral-600">
        {prepay != null
          ? t("Предоплата сразу за {n} ч · {rate}/ч (средняя цена, точную {payee} может уточнить в чате)", {
              n: hours,
              rate: formatTenge(o.pump_rate),
              payee,
            })
          : t("Предоплата сразу за {n} ч — цену за час {payee} напишет в чате", { n: hours, payee })}
      </div>
      {isDone && o.pump_hours_actual > hours && (
        <div className="text-xs font-semibold text-neutral-800">
          {t("Насос работал {n} ч — доплата {sum}", {
            n: o.pump_hours_actual,
            sum: extra ? formatTenge(extra) : t("по договорённости"),
          })}
        </div>
      )}
      {o.pump_prepaid_confirmed ? (
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-green-600 bg-green-100 rounded-lg py-2">
          <CheckCircle2 className="w-4 h-4" />
          {t("Предоплата получена")}
        </div>
      ) : o.pump_prepaid ? (
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-600 bg-amber-100 rounded-lg py-2">
          <Hourglass className="w-4 h-4 animate-pulse" />
          {t("Ждём подтверждения оплаты")}
        </div>
      ) : someoneTook ? (
        <>
          <div className="text-[11px] text-neutral-500">
            {t("Оплатите {payee} — реквизиты он пришлёт в чате. Без предоплаты насос не начинает работу.", { payee })}
          </div>
          <Button
            onClick={() => onPrepay(o.id)}
            disabled={busy === o.id}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-11"
          >
            {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Я оплатил {n} ч", { n: hours })}
          </Button>
        </>
      ) : (
        <div className="text-[11px] text-neutral-500">
          {t("Оплата откроется, когда насосник примет заявку.")}
        </div>
      )}
    </div>
  );
}

function OrderCard({ o, busy, onPay, onPrepay, onRate, onCancel, onReorder, ratePick, setRatePick }) {
  const navigate = useNavigate();
  const isPump = isPumpOrder(o);
  const st = ORDER_STATUSES[o.status || "new"] || ORDER_STATUSES.new;
  const isEnRoute = o.status === "en_route";
  const isDone = o.status === "done";
  const isCancelled = o.status === "cancelled";
  const isActive = !isDone && !isCancelled;
  const commission = (o.cubes || 0) * 1000;
  const material = o.total != null ? Math.max(o.total - commission, 0) : null;

  const fmtDate = (d) =>
    new Date(d).toLocaleString(locale(), {
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
      <button
        type="button"
        onClick={() => navigate(`/order/${o.id}`)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-bold text-neutral-900 inline-flex items-center gap-1.5">
          {isPump && <Construction className="w-4 h-4 text-sky-600" />}
          {o.order_number || t("Заказ")}
        </span>
        <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", st.cls)}>
          {t(statusLabel(o))}
        </span>
      </button>

      {isActive && (
        <button
          onClick={() => navigate(`/order/${o.id}`)}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white"
        >
          <MapPin className="w-4 h-4" />
          {o.driver_id ? t("Смотреть на карте") : t("Подробнее о заказе")}
        </button>
      )}

      {(o.grade || o.cubes || o.delivery_address || o.comment) && (
        <div className="text-xs text-neutral-600 space-y-1">
          {(o.grade || o.cubes) && (
            <div>
              {o.grade}
              {o.grade && o.cubes ? " · " : ""}
              {o.cubes ? t("{n} куб", { n: o.cubes }) : ""}
            </div>
          )}
          {o.delivery_address && <div>{t("Адрес: {address}", { address: o.delivery_address })}</div>}
          {o.comment && <div className="italic">{t("Комментарий: {text}", { text: o.comment })}</div>}
        </div>
      )}

      <OrderExtras o={o} showPhoto={false} />

      {o.driver_id && (
        <ChatButton
          kind="order"
          id={o.id}
          item={o}
          role="client"
          label={isPump ? t("Написать насоснику") : t("Написать миксеристу")}
        />
      )}

      {o.arrived_at && !isPump && <DowntimeTimer o={o} role="client" />}
      {o.arrived_at && isPump && <PumpWorkTimer o={o} role="client" />}

      {isPump && !isCancelled && <PumpPayment o={o} busy={busy} onPrepay={onPrepay} />}

      {isEnRoute && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-3 py-2.5">
            <Truck className="w-5 h-5" />
            <span className="font-bold text-sm">
              {isPump ? t("Насос выехал — скоро будет на объекте!") : t("Миксер выехал — ожидайте подачи!")}
            </span>
          </div>
          {o.driver_id && (
            <Suspense
              fallback={
                <div className="h-[35vh] rounded-2xl bg-neutral-100 animate-pulse" />
              }
            >
              <LiveDriverMap
                driverIds={[o.driver_id]}
                pumpIds={isPump ? [o.driver_id] : []}
                height="35vh"
              />
            </Suspense>
          )}
        </div>
      )}

      {o.needed_by && (
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 bg-neutral-100 rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5" />
          {t("Нужен к: {date}", {
            date: new Date(o.needed_by).toLocaleString(locale(), {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </div>
      )}

      {/* Заказчику — только текущий этап (значок вверху карточки), без
          полоски всех стадий: так карточка не перегружена. */}
      {isCancelled && (
        <div className="flex items-center gap-2 bg-red-100 text-red-700 rounded-lg px-3 py-2.5">
          <XCircle className="w-5 h-5" />
          <span className="font-bold text-sm">{t("Заказ отменён")}</span>
        </div>
      )}

      {isDone && o.may_reorder && onReorder && (
        <button
          onClick={() => onReorder(o)}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg bg-amber-400 text-neutral-900 hover:bg-amber-300"
        >
          <Repeat className="w-4 h-4" />
          {t("Дозаказать бетон на этот объект")}
        </button>
      )}

      {isDone && isPump && (
        <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
            {t("Оцените насосника")}
          </div>
          {o.client_rating ? (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-xs text-neutral-500">
                {t("Ваша оценка: {n}", { n: o.client_rating })}★
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
      )}

      {isDone && !isPump && (
        <div className="space-y-3 pt-1">
          <div className="rounded-xl border border-neutral-200 p-3 space-y-1">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
              {t("Блок А · Оплата за материал водителю")}
            </div>
            <div className="text-lg font-black text-neutral-900">
              {material != null ? `${material.toLocaleString(locale())} ₸` : t("по договорённости")}
            </div>
            <div className="text-xs text-neutral-500">
              {t("Переведите сумму напрямую водителю на Kaspi Gold или по его реквизитам.")}
            </div>
            {o.driver_name && (
              <div className="text-xs text-neutral-600">{t("Водитель: {name}", { name: o.driver_name })}</div>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              {t("Блок Б · Сервисный сбор PROBETON")}
            </div>
            <div className="text-lg font-black text-neutral-900">
              {commission.toLocaleString(locale())} ₸
            </div>
            <div className="text-[11px] text-neutral-500">{t("{n} куб × 1 000 ₸", { n: o.cubes || 0 })}</div>

            <div className="flex flex-col items-center justify-center bg-white border border-dashed border-amber-300 rounded-lg p-4">
              <QrCode className="w-16 h-16 text-neutral-800" />
              <div className="text-[10px] text-neutral-500 mt-1">
                {t("Kaspi QR — реквизиты PROBETON")}
              </div>
            </div>
            <div className="text-[10px] text-neutral-400 leading-snug">
              {t("Оплачивая счёт, вы подтверждаете выполнение информационных услуг платформой в полном объёме.")}
            </div>

            {o.commission_paid ? (
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-green-600 bg-green-100 rounded-lg py-2">
                <CheckCircle2 className="w-4 h-4" />
                {t("Оплата подтверждена")}
              </div>
            ) : o.client_paid ? (
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-600 bg-amber-100 rounded-lg py-2">
                <Hourglass className="w-4 h-4 animate-pulse" />
                {t("Ожидает подтверждения диспетчером")}
              </div>
            ) : (
              <Button
                onClick={() => onPay(o.id)}
                disabled={busy === o.id}
                className="w-full bg-amber-400 hover:bg-amber-300 text-neutral-900 font-bold h-11"
              >
                {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Я оплатил")}
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
              {t("Оцените водителя")}
            </div>
            {o.client_rating ? (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-xs text-neutral-500">
                  {t("Ваша оценка: {n}", { n: o.client_rating })}★
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

      {isActive && canClientCancel(o) && (
        <button
          onClick={() => onCancel(o.id)}
          disabled={busy === o.id}
          className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
        >
          <Ban className="w-3.5 h-3.5" />
          {t("Отменить заказ")}
        </button>
      )}

      {!isDone && !isCancelled && (
        <div className="text-xs text-neutral-500">{t("Создан: {date}", { date: fmtDate(o.created_date) })}</div>
      )}
    </div>
  );
}

// Выполненный заказ без незавершённых дел требует ещё оплаты сервисного
// сбора или оценки — такой остаётся полной карточкой (там кнопки).
function needsClientAction(o) {
  if (o.status !== "done") return false;
  if (!o.client_rating) return true;
  if (!isPumpOrder(o) && !o.client_paid && !o.commission_paid) return true;
  return false;
}

// Маленькая карточка завершённого заказа в конце списка. Нажатие
// открывает полную страницу заказа.
function HistoryRow({ o, onReorder }) {
  const navigate = useNavigate();
  const isPump = isPumpOrder(o);
  const isCancelled = o.status === "cancelled";
  const st = ORDER_STATUSES[o.status || "new"] || ORDER_STATUSES.new;
  const when = o.completed_at || o.created_date;
  const summary = [o.grade, o.cubes ? t("{n} куб", { n: o.cubes }) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "rounded-xl border",
        isCancelled ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
      )}
    >
      <button
        type="button"
        onClick={() => navigate(`/order/${o.id}`)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-neutral-50 rounded-xl"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
            {isPump && <Construction className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
            <span className="shrink-0">{o.order_number || t("Заказ")}</span>
            {summary && (
              <span className="truncate font-normal text-xs text-neutral-500">· {summary}</span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 truncate">
            {when
              ? new Date(when).toLocaleDateString(locale(), { day: "2-digit", month: "2-digit", year: "2-digit" })
              : ""}
            {o.delivery_address ? ` · ${o.delivery_address}` : ""}
          </div>
        </div>
        <span className={cn("shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold", st.cls)}>
          {t(statusLabel(o))}
        </span>
        <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
      </button>
      {o.status === "done" && o.may_reorder && onReorder && (
        <button
          type="button"
          onClick={() => onReorder(o)}
          className="mx-3 mb-2.5 w-[calc(100%-1.5rem)] flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg bg-amber-400 text-neutral-900"
        >
          <Repeat className="w-3.5 h-3.5" />
          {t("Дозаказать бетон на этот объект")}
        </button>
      )}
    </div>
  );
}

export default function OrderTracking({ onReorder }) {
  const { user, checkUserAuth } = useAuth();
  const activePhone = normPhone(user?.phone);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [ratePick, setRatePick] = useState({});
  // Заказы, о принятии которых мы уже сообщили. Supabase присылает в
  // payload.old только id (без driver_id), поэтому без этого списка
  // «Заказ принят!» всплывало заново на каждое изменение заказа.
  const notifiedAccepted = useRef(null);

  const fetchMine = async (num) => {
    if (!num) return;
    setLoading(true);
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      const mine = all.filter((o) => normPhone(o.phone) === num);
      if (notifiedAccepted.current === null) {
        notifiedAccepted.current = new Set(
          mine.filter((o) => o.driver_id).map((o) => o.id)
        );
      }
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
      const orderId = payload?.new?.id;
      const alreadyNotified =
        !!orderId && !!notifiedAccepted.current?.has(orderId);
      const nowAssigned = !!payload?.new?.driver_id;
      const belongsToMe =
        payload?.new?.phone && normPhone(payload.new.phone) === activePhone;
      if (
        payload?.eventType === "UPDATE" &&
        !alreadyNotified &&
        nowAssigned &&
        belongsToMe
      ) {
        if (!notifiedAccepted.current) notifiedAccepted.current = new Set();
        notifiedAccepted.current.add(orderId);
        notify(
          t("Заказ принят!"),
          t("{who} {name} принял ваш заказ", {
            who: t(workerLabel(payload.new)),
            name: payload.new.driver_name || "",
          }).replace(/\s+/g, " ").trim()
        );
      }
    });
    return unsub;
  }, [activePhone]);

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

  const prepayPump = async (id) => {
    if (!confirm(t("Подтвердите, что оплатили предоплату за АБН. Насосник проверит поступление."))) return;
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { pump_prepaid: true });
    } catch (e) {
      console.error(e);
      alert(pumpErrorText(e));
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
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    setBusy(id);
    try {
      // Отмена заказчиком = предупреждение (3 — чёрный список).
      const done = await cancelOrderAsClient(order, user);
      if (done) {
        await checkUserAuth();
        fetchMine(activePhone);
      }
    } catch (e) {
      console.error(e);
      alert(t("Не удалось отменить заказ. Попробуйте ещё раз."));
    } finally {
      setBusy(null);
    }
  };

  // Наверху — полными карточками: текущие заказы и выполненные, где ещё
  // нужно оплатить или оценить. Внизу — история маленькими карточками.
  const isOpen = (o) =>
    (o.status !== "done" && o.status !== "cancelled") || needsClientAction(o);
  const activeOrders = orders.filter(isOpen);
  const historyOrders = orders.filter((o) => !isOpen(o));

  return (
    <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
          <Truck className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900">{t("Мой заказ")}</h2>
          <p className="text-xs text-neutral-500">
            {t("Статус и оплата в реальном времени")}
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
          <p className="text-sm">{t("У вас пока нет заказов")}</p>
        </div>
      ) : null}

      {activeOrders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 px-1">
            {activeOrders.length === 1 ? t("Активный заказ") : t("Активные заказы")}
          </h3>
          <div className="space-y-3">
            {activeOrders.map((o) => (
              <OrderCard
                key={o.id}
                o={o}
                busy={busy}
                onPay={payDone}
                onPrepay={prepayPump}
                onRate={rateDriver}
                onCancel={cancelOrder}
                onReorder={onReorder}
                ratePick={ratePick}
                setRatePick={setRatePick}
              />
            ))}
          </div>
        </div>
      )}

      {historyOrders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 px-1">
            {t("История заказов")}
          </h3>
          <div className="space-y-2">
            {historyOrders.map((o) => (
              <HistoryRow key={o.id} o={o} onReorder={onReorder} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
