import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import {
  ArrowLeft,
  Phone,
  Loader2,
  LogOut,
  Star,
  Truck,
  Construction,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ChevronRight,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { t, locale } from "@/lib/i18n";
import { pumpTitle } from "@/lib/pump";
import { formatTenge } from "@/lib/balance";
import { setOffline } from "@/lib/driverLocation";
import { WARN_LIMIT } from "@/lib/warnings";
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, normPhone, statusLabel } from "@/lib/orderStatuses";
import StaticPointMap from "@/components/StaticPointMap";

// Сколько заказов в истории показывать сразу (дальше — «Показать ещё»).
const PAGE = 20;

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "done", label: "Выполненные" },
  { id: "cancelled", label: "Отменённые" },
];

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString(locale(), {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// Сколько прошло времени: «5 мин назад», «2 ч назад», «3 дн назад».
function ago(d) {
  if (!d) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (min < 60) return t("{n} мин назад", { n: min });
  const h = Math.round(min / 60);
  if (h < 48) return t("{n} ч назад", { n: h });
  return t("{n} дн назад", { n: Math.round(h / 24) });
}

function Stat({ label, value, icon: Icon, cls = "text-neutral-900" }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-3">
      <div className="text-[11px] text-neutral-500 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`text-lg font-black ${cls}`}>{value}</div>
    </div>
  );
}

function OrderRow({ o }) {
  const st = ORDER_STATUSES[o.status || "new"];
  const isPump = o.service_type === "pump";
  return (
    <Link
      to={`/order/${o.id}`}
      className="block bg-white rounded-xl border border-neutral-200 p-3 hover:border-neutral-300"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-sm text-neutral-900 truncate">
          {o.order_number || t("Заказ")}
          {o.trip_no && o.trips_total > 1 ? ` · ${t("рейс {n}", { n: o.trip_no })}` : ""}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st?.cls || ""}`}>
          {t(statusLabel(o))}
        </span>
      </div>
      <div className="text-xs text-neutral-700 mt-1">
        {isPump
          ? [pumpTitle(o.pump_boom), o.pump_hours_actual || o.pump_hours ? t("{h} ч", { h: o.pump_hours_actual || o.pump_hours }) : null]
              .filter(Boolean)
              .join(" · ")
          : [o.grade, o.cubes ? t("{n} куб", { n: o.cubes }) : null, o.what_needed && !o.grade ? o.what_needed : null]
              .filter(Boolean)
              .join(" · ")}
      </div>
      {o.delivery_address && (
        <div className="text-xs text-neutral-500 mt-0.5 flex items-start gap-1">
          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="line-clamp-1">{o.delivery_address}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1.5">
        <span>
          {o.status === "done" && o.completed_at
            ? t("Выполнен: {d}", { d: fmtDate(o.completed_at) })
            : t("Создан: {d}", { d: fmtDate(o.created_date) })}
        </span>
        <span className="flex items-center gap-2">
          {o.client_rating ? (
            <span className="text-amber-500 font-semibold">{o.client_rating}★</span>
          ) : null}
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

// Отдельная страница миксериста или насосника АБН — только для админа.
// Открывается из «Партнёров»: и с карты «на линии», и из списка «не на линии».
export default function AdminDriverPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [location, setLocation] = useState(null);
  const [orders, setOrders] = useState([]);
  const [leftovers, setLeftovers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: u, error } = await supabase.from("app_users").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!u) {
        setNotFound(true);
        return;
      }
      const phone10 = normPhone(u.phone);
      const [loc, ord, left, tx] = await Promise.all([
        supabase.from("driver_locations").select("*").eq("driver_id", id).maybeSingle(),
        supabase
          .from("orders")
          .select("*")
          .eq("driver_id", id)
          .order("created_date", { ascending: false })
          .limit(500),
        supabase.from("leftovers").select("*").order("created_date", { ascending: false }).limit(500),
        supabase
          .from("balance_transactions")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      setPerson(u);
      setLocation(loc.data || null);
      setOrders(ord.data || []);
      // Остатки сохранялись то с id, то только с телефоном — ищем по обоим.
      setLeftovers(
        (left.data || []).filter(
          (l) => l.driver_id === id || (phone10 && normPhone(l.phone) === phone10)
        )
      );
      setTransactions(tx.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    // Живое обновление: заказы, положение на линии, сам профиль.
    const channel = supabase
      .channel(`admin-driver:${id}:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${id}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_users", filter: `id=eq.${id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const removeFromLine = async () => {
    setBusy(true);
    try {
      await setOffline(id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-24 text-neutral-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (notFound || !person) {
    return (
      <div className="p-4 space-y-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-neutral-600">
          <ArrowLeft className="w-4 h-4" />
          {t("Назад")}
        </button>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          {t("Аккаунт не найден — возможно, он удалён")}
        </div>
      </div>
    );
  }

  const isPump = person.account_type === "pump";
  const name = person.full_name || person.driver_name || person.phone;
  const online = !!location?.is_online;
  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const done = orders.filter((o) => o.status === "done");
  const cancelled = orders.filter((o) => o.status === "cancelled");
  const rated = done.filter((o) => Number(o.client_rating) > 0);
  const avgRating = rated.length
    ? (rated.reduce((s, o) => s + Number(o.client_rating), 0) / rated.length).toFixed(1)
    : null;
  const totalCubes = done.reduce((s, o) => s + Number(o.cubes || 0), 0);
  const totalHours = done.reduce((s, o) => s + Number(o.pump_hours_actual || o.pump_hours || 0), 0);
  const unpaid = done.filter((o) => !o.driver_payment_confirmed && o.service_type !== "pump");
  const lastDone = done.reduce(
    (m, o) => (o.completed_at && (!m || o.completed_at > m) ? o.completed_at : m),
    null
  );

  const list = filter === "done" ? done : filter === "cancelled" ? cancelled : orders;
  const warnings = Number(person.warnings || 0);

  return (
    <div className="p-4 space-y-4 pb-24">
      <button
        onClick={() => navigate(`/partners?tab=${isPump ? "pumps" : "drivers"}`)}
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="w-4 h-4" />
        {isPump ? t("Насосники АБН") : t("Миксеристы")}
      </button>

      {/* Кто это */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border border-neutral-200" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
              {isPump ? <Construction className="w-7 h-7" /> : <Truck className="w-7 h-7" />}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-black text-neutral-900 truncate">{name}</h1>
            <div className="text-sm text-neutral-500">
              {isPump ? t("Насосник АБН") : t("Миксерист")}
              {isPump && person.pump_boom ? ` · ${pumpTitle(person.pump_boom)}` : ""}
            </div>
            <div className="text-xs text-neutral-400">
              {t("В приложении с {d}", { d: fmtDate(person.created_date) })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <span className="text-neutral-500">{t("Телефон")}</span>
          <span className="font-semibold text-neutral-900">{person.phone || "—"}</span>
          <span className="text-neutral-500">{t("Гос. номер")}</span>
          <span className="font-semibold text-neutral-900">{person.vehicle_plate || "—"}</span>
          <span className="text-neutral-500">{t("Аккаунт")}</span>
          <span
            className={`font-semibold ${person.approval_status === "approved" ? "text-green-600" : "text-amber-600"}`}
          >
            {person.approval_status === "approved" ? t("Одобрен") : t("На одобрении")}
          </span>
          <span className="text-neutral-500">{t("Предупреждения")}</span>
          <span className={`font-semibold ${warnings > 0 ? "text-red-600" : "text-neutral-900"}`}>
            {warnings} / {WARN_LIMIT}
          </span>
          <span className="text-neutral-500">{t("Баланс")}</span>
          <span className="font-semibold text-neutral-900">{formatTenge(person.balance)}</span>
        </div>

        {person.phone && (
          <a
            href={`tel:${person.phone}`}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
          >
            <Phone className="w-4 h-4" />
            {t("Позвонить")}
          </a>
        )}
      </div>

      {/* Что сейчас */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
        <h2 className="font-bold text-neutral-900">{t("Сейчас")}</h2>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              online ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-neutral-400"}`} />
            {online ? t("На линии") : t("Не на линии")}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              active.length ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            <Clock className="w-3 h-3" />
            {active.length ? t("В работе: {n} заказ(ов)", { n: active.length }) : t("Свободен")}
          </span>
        </div>
        {location?.updated_at && (
          <div className="text-xs text-neutral-400">
            {online
              ? t("Местоположение обновлено {ago}", { ago: ago(location.updated_at) })
              : t("Последний раз был на линии {ago}", { ago: ago(location.updated_at) })}
          </div>
        )}
        {online && location?.lat && location?.lng && (
          <StaticPointMap lat={location.lat} lng={location.lng} label={name} height="24vh" />
        )}
        {active.length > 0 && (
          <div className="space-y-2">
            {active.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </div>
        )}
        {online && (
          <button
            onClick={removeFromLine}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-semibold hover:bg-neutral-200 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {t("Убрать с линии")}
          </button>
        )}
      </div>

      {/* Итоги */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t("Выполнено")} value={done.length} icon={CheckCircle2} cls="text-green-600" />
        {isPump ? (
          <Stat label={t("Часов работы")} value={Math.round(totalHours * 10) / 10} icon={Clock} />
        ) : (
          <Stat label={t("Кубов привёз")} value={Math.round(totalCubes * 10) / 10} icon={Truck} />
        )}
        <Stat label={t("Средняя оценка")} value={avgRating ? `${avgRating}★` : "—"} icon={Star} cls="text-amber-500" />
        <Stat label={t("Отменено")} value={cancelled.length} icon={XCircle} cls={cancelled.length ? "text-red-600" : "text-neutral-900"} />
      </div>
      <div className="text-xs text-neutral-500 px-1 space-y-0.5">
        {lastDone && <div>{t("Последний выполненный заказ: {d}", { d: fmtDate(lastDone) })}</div>}
        {rated.length > 0 && <div>{t("Оценок от заказчиков: {n}", { n: rated.length })}</div>}
        {unpaid.length > 0 && (
          <div className="text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {t("Оплата сервиса не подтверждена по {n} заказ(ам)", { n: unpaid.length })}
          </div>
        )}
      </div>

      {/* История заказов */}
      <div className="space-y-2">
        <h2 className="font-bold text-neutral-900 px-1">{t("История заказов ({n})", { n: orders.length })}</h2>
        <div className="flex bg-neutral-200 rounded-xl p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setShown(PAGE);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                filter === f.id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
            {t("Заказов пока нет")}
          </div>
        ) : (
          <>
            {list.slice(0, shown).map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
            {list.length > shown && (
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="w-full py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-semibold hover:bg-neutral-200"
              >
                {t("Показать ещё ({n})", { n: list.length - shown })}
              </button>
            )}
          </>
        )}
      </div>

      {/* Остатки (Кубовик) — только у миксеристов */}
      {!isPump && (
        <div className="space-y-2">
          <h2 className="font-bold text-neutral-900 px-1">{t("Остатки бетона ({n})", { n: leftovers.length })}</h2>
          {leftovers.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-400">
              {t("Остатков не публиковал")}
            </div>
          ) : (
            leftovers.slice(0, 10).map((l) => (
              <Link
                key={l.id}
                to={`/leftover/${l.id}`}
                className="flex items-center justify-between gap-2 bg-white rounded-xl border border-neutral-200 p-3 text-sm hover:border-neutral-300"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-neutral-900">
                    {[l.grade, l.cubes ? t("{n} куб", { n: l.cubes }) : null].filter(Boolean).join(" · ")}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    {[l.direction, fmtDate(l.created_date)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="text-xs font-semibold text-neutral-500 shrink-0">
                  {l.status === "intercepted" ? t("Забрали") : l.status === "available" ? t("Доступен") : t("Закрыт")}
                </span>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Движения по балансу */}
      {transactions.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-neutral-900 px-1 flex items-center gap-1.5">
            <Wallet className="w-4 h-4" />
            {t("Операции по балансу")}
          </h2>
          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                <div className="min-w-0">
                  <div className="text-neutral-800 truncate">{tx.note || (tx.kind === "topup" ? t("Пополнение") : tx.kind)}</div>
                  <div className="text-[11px] text-neutral-400">{fmtDate(tx.created_at)}</div>
                </div>
                <span className={`font-semibold shrink-0 ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {Number(tx.amount) > 0 ? "+" : ""}
                  {formatTenge(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
