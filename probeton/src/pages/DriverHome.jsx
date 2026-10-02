import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Inbox,
  Package,
  MapPin,
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
import { t, locale } from "@/lib/i18n";
import ChatButton from "@/components/ChatButton";
import { PLANT_ACTIVE_STATUSES, plantName } from "@/lib/plants";
import OrderExtras from "@/components/OrderExtras";
import DowntimeTimer from "@/components/DowntimeTimer";
import { getEffectiveRole } from "@/lib/effectiveRole";
import { isPumpOrder, pumpErrorText, pumpFinalTotal, PUMP_MIN_HOURS } from "@/lib/pump";
import { formatTenge } from "@/lib/balance";

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
  const navigate = useNavigate();
  const { user, viewMode } = useAuth();
  // Насосник АБН работает в той же ленте, но видит только заявки на АБН.
  const isPump = getEffectiveRole(user, viewMode) === "pump";
  const [orders, setOrders] = useState([]);
  const [hoursDraft, setHoursDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [ratePick, setRatePick] = useState({});
  const [myPlant, setMyPlant] = useState(null);
  const myOrderIdsRef = useRef(null);

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      setOrders(all);
      // Уведомление, когда завод или админ назначили этого миксериста.
      const mine = all
        .filter((o) => o.driver_id === user?.id && PLANT_ACTIVE_STATUSES.includes(o.status))
        .map((o) => o.id);
      if (myOrderIdsRef.current && user?.notifications_enabled !== false) {
        if (mine.some((id) => !myOrderIdsRef.current.has(id))) {
          notify(t("Вам назначен заказ"), t("Откройте ленту, чтобы посмотреть адрес"));
        }
      }
      myOrderIdsRef.current = new Set(mine);
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
        (payload.new?.status || "new") === "new" &&
        !payload.new?.plant_id &&
        isPumpOrder(payload.new) === isPump
      ) {
        notify(
          t("Новая заявка!"),
          payload.new?.what_needed ||
            (isPump ? t("Появилась заявка на АБН") : t("Появился новый заказ на бетон"))
        );
      }
    });
    return unsub;
     
  }, [user?.notifications_enabled, isPump]);

  // Миксерист в парке завода: завод выдаёт ему свои заказы, но личные
  // заявки из общей ленты и Кубовик остаются его — завод их не видит.
  useEffect(() => {
    if (!user?.plant_id) {
      setMyPlant(null);
      return;
    }
    let mounted = true;
    supabase
      .from("app_users")
      .select("id, full_name, phone")
      .eq("id", user.plant_id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setMyPlant(data || null);
      });
    return () => {
      mounted = false;
    };
  }, [user?.plant_id]);

  // Проверка одобрения теперь общая для всех ролей — в ProtectedRoute.

  const inFleet = !!user?.plant_id;
  // Заявки, переданные заводу, в общей ленте не показываются.
  // Заявки «с документами» выполняют только заводы — миксеристам их
  // тоже не показываем.
  // Насоснику — только заявки на АБН (в том числе те, где завод
  // нанимает насос на сайте), миксеристу — только бетон.
  const free = orders.filter((o) => {
    if ((o.status || "new") !== "new" || o.driver_id) return false;
    if (isPump) return isPumpOrder(o) && (!o.plant_id || o.pump_hire_open);
    return !isPumpOrder(o) && !o.plant_id && !o.with_documents;
  });
  // Стрела насосника короче, чем нужно по заявке, — взять нельзя.
  const boomTooShort = (o) =>
    isPump && !!user?.pump_boom && !!o.pump_boom && Number(user.pump_boom) < Number(o.pump_boom);
  // Мои заказы в работе — любой статус между «принят» и «готов».
  // Раньше здесь был только in_progress, и заказ пропадал у водителя,
  // как только админ переводил его в «Назначен миксер» / «В пути».
  const isMyOpenOrder = (o) =>
    o.driver_id === user?.id &&
    (o.status || "new") !== "done" &&
    o.status !== "cancelled";
  const active = orders.filter(isMyOpenOrder);
  const completed = orders.filter(
    (o) => o.driver_id === user?.id && o.status === "done"
  );
  // Пока у водителя есть незавершённый заказ (не оплачен или ждёт
  // подтверждения менеджера) — новые заявки принимать нельзя.
  // Отменённый заказ не считается незавершённым — иначе водитель
  // навсегда терял возможность брать новые заявки после отмены клиентом.
  const hasUnfinishedOrder = orders.some(isMyOpenOrder);

  const accept = async (o) => {
    if (boomTooShort(o)) return;
    if (hasUnfinishedOrder) {
      alert(t("Сначала завершите и оплатите текущий заказ — новые заявки пока недоступны."));
      return;
    }
    setBusy(o.id);
    // Сам взял — уведомлять «вам назначен заказ» не нужно.
    myOrderIdsRef.current?.add(o.id);
    try {
      // Забираем заказ, только если он всё ещё свободен: если два водителя
      // нажали одновременно, второй не перезапишет первого.
      const { data, error } = await supabase
        .from("orders")
        .update({
          driver_id: user.id,
          driver_name: user.full_name || user.driver_name || "Водитель",
          status: "in_progress",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", o.id)
        .eq("status", "new")
        .is("driver_id", null)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        alert(t("Этот заказ уже взял другой водитель."));
      }
    } catch (e) {
      console.error(e);
      alert(t("Не удалось взять заказ. Проверьте интернет и попробуйте ещё раз."));
    } finally {
      setBusy(null);
      load();
    }
  };

  const payCommission = async (id) => {
    const o = orders.find((x) => x.id === id);
    const pump = isPumpOrder(o);
    if (
      !confirm(
        pump
          ? t("Подтвердите, что работа выполнена. Менеджер проверит и завершит заказ.")
          : t("Подтвердите, что оплатили сервисный сбор PROBETON. После этого менеджер проверит оплату и завершит заказ.")
      )
    )
      return;
    setBusy(id);
    try {
      const fields = { driver_paid: true };
      // Насосник указывает, сколько часов фактически отработал.
      if (pump) {
        fields.pump_hours_actual = Math.max(
          PUMP_MIN_HOURS,
          Number(o.pump_hours || 0),
          Number(hoursDraft[id] || o.pump_hours || 0)
        );
      }
      await base44.entities.Order.update(id, fields);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
      load();
    }
  };

  // Насосник отмечает, что клиент внёс предоплату (если заявку ведёт
  // завод — это делает завод).
  const confirmPrepay = async (id) => {
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { pump_prepaid_confirmed: true });
    } catch (e) {
      console.error(e);
      alert(pumpErrorText(e));
    } finally {
      setBusy(null);
      load();
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
    if (!confirm(t("Подать жалобу на прораба и внести номер в чёрный список?"))) return;
    setBusy(o.id);
    try {
      await base44.entities.Blacklist.create({
        phone: o.phone,
        reason: "Неоплата от прораба",
      });
      alert(t("Жалоба отправлена. Диспетчер рассмотрит обращение."));
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
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
    <div className="p-4 space-y-5">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">
          {t("Здравствуйте, {name}", { name: user?.full_name || t("партнёр") })}
        </h1>
        <p className="text-sm text-neutral-500">
          {isPump
            ? t("Заявки на АБН — первый взявший заказ забирает его")
            : t("Биржа бетона — первый взявший заказ забирает его")}
        </p>
        {isPump && !user?.pump_boom && user?.role !== "admin" && (
          <button
            onClick={() => navigate("/profile")}
            className="mt-2 w-full text-left text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5"
          >
            {t("Укажите длину стрелы вашего АБН в Профиле — тогда лента подскажет, какие заявки вам подходят.")}
          </button>
        )}
      </div>

      {inFleet && (
        <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl px-3 py-2.5 text-xs font-semibold">
          <Truck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {isPump
              ? t("Вы в парке завода «{name}». Заказы от завода появятся здесь. Личные заявки из ленты — ваши, завод их не видит.", {
                  name: myPlant ? plantName(myPlant) : "…",
                })
              : t("Вы в парке завода «{name}». Заказы от завода появятся здесь. Личные заявки из ленты и Кубовик — ваши, завод их не видит.", {
                  name: myPlant ? plantName(myPlant) : "…",
                })}
          </span>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
            {t("Мои заказы в работе ({count})", { count: active.length })}
          </div>
          {active.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                  <Truck className="w-3 h-3" /> {t("В процессе")}
                </span>
                <span className="text-xs text-neutral-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDate(o.created_date)}
                </span>
              </div>
              <button
                onClick={() => navigate(`/order/${o.id}`)}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white"
              >
                <MapPin className="w-4 h-4" />
                {t("Открыть — карта, маршрут и чат")}
              </button>
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                <p className="text-sm text-neutral-800 font-medium leading-snug">
                  {o.what_needed}
                </p>
              </div>
              <OrderExtras o={o} />
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
                        {t("на карте")}
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
              {o.plant_id ? (
                // Заявку ведёт завод — исполнитель пишет заводу, не заказчику.
                <ChatButton
                  kind="fleet"
                  id={o.id}
                  item={o}
                  role="driver"
                  label={t("Написать заводу{name}", { name: o.plant_name ? ` · ${o.plant_name}` : "" })}
                />
              ) : (
                <ChatButton
                  kind="order"
                  id={o.id}
                  item={o}
                  role="driver"
                  label={t("Написать заказчику")}
                />
              )}
              {isPumpOrder(o) ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-2">
                  <div className="text-xs font-bold text-sky-800">
                    {o.pump_prepaid_confirmed
                      ? t("Предоплата получена — можно работать")
                      : o.pump_prepaid
                      ? t("Клиент отметил, что оплатил {n} ч — проверьте поступление", { n: Math.max(PUMP_MIN_HOURS, Number(o.pump_hours || 0)) })
                      : t("Клиент ещё не внёс предоплату за {n} ч — до оплаты лучше не начинать", { n: Math.max(PUMP_MIN_HOURS, Number(o.pump_hours || 0)) })}
                  </div>
                  {!o.pump_prepaid_confirmed && !o.plant_id && (
                    <button
                      onClick={() => confirmPrepay(o.id)}
                      disabled={busy === o.id}
                      className="w-full text-xs font-bold py-2 rounded-lg bg-sky-600 text-white disabled:opacity-50"
                    >
                      {t("Предоплата получена")}
                    </button>
                  )}
                  {!o.driver_paid && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-700">{t("Отработано часов")}</span>
                      <input
                        type="number"
                        min={PUMP_MIN_HOURS}
                        step="0.5"
                        value={hoursDraft[o.id] ?? String(o.pump_hours || PUMP_MIN_HOURS)}
                        onChange={(e) => setHoursDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                        className="w-20 h-9 rounded-lg border border-neutral-200 px-2 text-sm text-right"
                      />
                    </div>
                  )}
                  {o.pump_rate ? (
                    <div className="text-[11px] text-neutral-600">
                      {t("Итого за работу: {sum}", {
                        sum: formatTenge(
                          pumpFinalTotal({ ...o, pump_hours_actual: o.pump_hours_actual ?? hoursDraft[o.id] })
                        ),
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <DowntimeTimer o={o} role="driver" userId={user?.id} onChanged={load} />
              )}
              {o.driver_payment_confirmed ? (
                <div className="w-full text-xs font-bold py-2.5 rounded-lg bg-green-100 text-green-700 inline-flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {t("Оплата подтверждена — завершается")}
                </div>
              ) : o.driver_paid ? (
                <div className="w-full text-xs font-bold py-2.5 rounded-lg bg-amber-100 text-amber-700 inline-flex items-center justify-center gap-1">
                  <Hourglass className="w-4 h-4 animate-pulse" />
                  {t("Ожидает подтверждения менеджером")}
                </div>
              ) : o.arrived_at && !o.unloaded_at ? (
                <div className="w-full text-xs font-semibold py-2.5 px-3 rounded-lg bg-neutral-100 text-neutral-600 text-center">
                  {t("Когда закончите выгрузку, нажмите «Выгрузка закончена» — потом откроется оплата сбора.")}
                </div>
              ) : isPumpOrder(o) ? (
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
                      {t("Работа выполнена — завершить заказ")}
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-center">
                    <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                      {t("Сервисный сбор PROBETON")}
                    </div>
                    <div className="text-lg font-black text-neutral-900">
                      {((o.cubes || 0) * 1000).toLocaleString(locale())} ₸
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {t("{cubes} куб × 1 000 ₸ · оплата на Kaspi PROBETON", { cubes: o.cubes || 0 })}
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
                        {t("Я оплатил — завершить заказ")}
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
            {t("Завершённые ({count})", { count: completed.length })}
          </div>
          {completed.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-600">
                  <CheckCircle2 className="w-3 h-3" /> {isPumpOrder(o) ? t("Выполнено") : t("Доставлено")}
                </span>
                {o.commission_paid ? (
                  <span className="text-xs font-bold text-green-600">{t("Оплачено")}</span>
                ) : o.client_paid ? (
                  <span className="text-xs font-bold text-amber-600">
                    {t("Ожидает оплаты сбора")}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-neutral-400">
                    {t("Ждём оплату клиента")}
                  </span>
                )}
              </div>
              <div className="text-sm text-neutral-700 font-medium">
                {o.what_needed}
              </div>
              {o.arrived_at && !isPumpOrder(o) && (
                <DowntimeTimer o={o} role="driver" userId={user?.id} onChanged={load} />
              )}
              {o.driver_rating ? (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-neutral-500">
                    {t("Вы оценили клиента: {rating}★", { rating: o.driver_rating })}
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-xs text-neutral-500">{t("Оцените клиента:")}</div>
                  <Stars
                    value={ratePick[o.id] || 0}
                    onChange={(n) => {
                      setRatePick((p) => ({ ...p, [o.id]: n }));
                      rateClient(o.id, n);
                    }}
                  />
                </div>
              )}
              {/* Если клиент уже оплатил — жаловаться на неоплату незачем. */}
              {!o.client_paid && !o.commission_paid && (
                <button
                  onClick={() => complain(o)}
                  disabled={busy === o.id}
                  className="w-full text-xs font-bold py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center gap-1"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {t("Жалоба: клиент не оплатил")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
        {t("Свободные заказы ({count})", { count: free.length })}
      </div>

      {hasUnfinishedOrder && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-xs font-semibold">
          <Ban className="w-4 h-4 shrink-0" />
          {t("У вас есть незавершённый заказ — заверьте оплату и дождитесь подтверждения менеджера, чтобы принимать новые заявки.")}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          {t("Загрузка...")}
        </div>
      ) : free.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("Пока нет свободных заказов")}</p>
          <p className="text-xs mt-1">{t("Новые заявки появятся здесь автоматически")}</p>
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
                  <Inbox className="w-3 h-3" /> {isPumpOrder(o) ? t("Поиск насоса") : t("Поиск машины")}
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
                  {o.cubes ? ` · ${t("{cubes} куб", { cubes: o.cubes })}` : ""}
                </div>
              )}
              <OrderExtras o={o} className="pl-6" />
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
                        {t("на карте")}
                      </a>
                    )}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
                <Headphones className="w-3.5 h-3.5 text-neutral-400" />
                {t("Номер скрыт — после принятия откроется чат с заказчиком")}
              </div>
              {o.pump_hire_open && (
                <div className="text-xs font-semibold text-purple-700 bg-purple-50 rounded-lg px-3 py-2">
                  {t("Насос нанимает завод «{name}» — общаться будете с заводом", { name: o.plant_name || "" })}
                </div>
              )}
              {boomTooShort(o) && (
                <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {t("Нужна стрела {need} м, у вас {mine} м — эта заявка вам не подходит", {
                    need: o.pump_boom,
                    mine: user.pump_boom,
                  })}
                </div>
              )}
              <button
                onClick={() => accept(o)}
                disabled={busy === o.id || hasUnfinishedOrder || boomTooShort(o)}
                className="w-full text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
              >
                {busy === o.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : hasUnfinishedOrder ? (
                  <>
                    <Ban className="w-4 h-4" />
                    {t("Сначала завершите текущий заказ")}
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    {t("Готов выехать — взять заказ")}
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
