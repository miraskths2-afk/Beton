import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Inbox,
  Package,
  MapPin,
  Phone,
  Clock,
  Loader2,
  Truck,
  Droplets,
  Send,
  Undo2,
  Factory,
  CheckCircle2,
  Hourglass,
  UserCog,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notifications";
import { t, locale } from "@/lib/i18n";
import { ORDER_STATUSES } from "@/lib/orderStatuses";
import { plantName, plantsErrorText } from "@/lib/plants";
import AssignFleetDriverDialog from "@/components/AssignFleetDriverDialog";
import OrderExtras from "@/components/OrderExtras";

// Кабинет завода / БСУ.
// - Принимает свободные заявки клиентов из общей ленты.
// - Получает заявки, которые передал админ.
// - Выделяет на заявку миксериста из своего парка и ведёт статусы
//   (изготовление → в пути). Завершение заказа — только через
//   подтверждение оплаты админом, как и раньше.
export default function PlantHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [assignOrder, setAssignOrder] = useState(null);
  const myIdsRef = useRef(null);

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 300);
      setOrders(all);
      // Уведомление: админ передал заводу новую заявку.
      const mine = all.filter((o) => o.plant_id === user?.id).map((o) => o.id);
      if (myIdsRef.current && user?.notifications_enabled !== false) {
        const fresh = mine.filter((id) => !myIdsRef.current.has(id));
        if (fresh.length > 0) {
          notify(t("Новая заявка для завода"), t("Админ передал вам заявку — выделите миксер"));
        }
      }
      myIdsRef.current = new Set(mine);
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
        !payload.new?.plant_id
      ) {
        notify(t("Новая заявка!"), payload.new?.what_needed || t("Появился новый заказ на бетон"));
      }
    });
    return unsub;
  }, [user?.id, user?.notifications_enabled]);

  const free = orders.filter(
    (o) => (o.status || "new") === "new" && !o.driver_id && !o.plant_id
  );
  const mine = orders.filter((o) => o.plant_id === user?.id);
  const needDriver = mine.filter((o) => (o.status || "new") === "new" && !o.driver_id);
  const working = mine.filter(
    (o) => o.driver_id && o.status !== "done" && o.status !== "cancelled"
  );
  const done = mine.filter((o) => o.status === "done").slice(0, 10);

  const run = async (id, fn) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      console.error(err);
      setError(t(plantsErrorText(err)));
    } finally {
      setBusy(null);
    }
  };

  // Принять свободную заявку: условие в запросе не даёт двум заводам
  // (или заводу и миксеристу) забрать одну заявку одновременно.
  const take = (o) =>
    run(o.id, async () => {
      const { data, error: upErr } = await supabase
        .from("orders")
        .update({ plant_id: user.id, plant_name: plantName(user) })
        .eq("id", o.id)
        .eq("status", "new")
        .is("driver_id", null)
        .is("plant_id", null)
        .select("id");
      if (upErr) throw upErr;
      if (!data || data.length === 0) {
        throw new Error(t("Заявку уже забрали."));
      }
    });

  const giveBack = (o) => {
    if (!confirm(t("Вернуть заявку в общую ленту? Её смогут взять другие заводы и миксеристы."))) return;
    run(o.id, async () => {
      const { error: upErr } = await supabase
        .from("orders")
        .update({ plant_id: null, plant_name: null, driver_id: null, driver_name: null, accepted_at: null, status: "new" })
        .eq("id", o.id)
        .eq("plant_id", user.id);
      if (upErr) throw upErr;
    });
  };

  const setStatus = (o, status) =>
    run(o.id, async () => {
      const { error: upErr } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", o.id)
        .eq("plant_id", user.id);
      if (upErr) throw upErr;
    });

  const fmtDate = (d) =>
    new Date(d).toLocaleString(locale(), {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderInfo = (o, showPhone) => (
    <>
      <div className="flex items-start gap-2">
        <Package className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
        <p className="text-sm text-neutral-800 font-medium leading-snug">{o.what_needed}</p>
      </div>
      {(o.grade || o.cubes) && (
        <div className="text-xs text-neutral-500 pl-6">
          {o.grade}
          {o.grade && o.cubes ? " · " : ""}
          {o.cubes ? t("{n} куб", { n: o.cubes }) : ""}
        </div>
      )}
      <OrderExtras o={o} className="pl-6" />
      {o.delivery_address && (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
          <p className="text-sm text-neutral-600">{o.delivery_address}</p>
        </div>
      )}
      {o.needed_by && (
        <div className="text-xs font-bold text-red-600 pl-6 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {t("Нужен к:")} {fmtDate(o.needed_by)}
        </div>
      )}
      {showPhone ? (
        <a
          href={`tel:${o.phone}`}
          className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
        >
          <Phone className="w-4 h-4" />
          {t("Клиент: {phone}", { phone: o.phone })}
        </a>
      ) : (
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
          <Headphones className="w-3.5 h-3.5 text-neutral-400" />
          {t("Контакты клиента откроются после принятия заявки")}
        </div>
      )}
    </>
  );

  const renderHead = (o) => {
    const st = ORDER_STATUSES[o.status || "new"] || ORDER_STATUSES.new;
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {o.order_number && <span className="text-xs font-bold text-neutral-400">{o.order_number}</span>}
          <span className={cn("inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold", st.cls)}>
            {t(st.label)}
          </span>
        </div>
        <span className="text-xs text-neutral-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {fmtDate(o.created_date)}
        </span>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-5">
      <div className="px-1 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
          <Factory className="w-5 h-5 text-purple-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-neutral-900 truncate">{plantName(user)}</h1>
          <p className="text-sm text-neutral-500">{t("Заявки клиентов и ваш парк миксеров")}</p>
        </div>
      </div>

      {user?.plant_active === false && (
        <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          {t("Админ отметил завод как «не работает» — новые заявки от него сейчас не приходят. Свободные заявки из ленты принимать можно.")}
        </div>
      )}

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          {t("Загрузка...")}
        </div>
      ) : (
        <>
          {needDriver.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-purple-600 uppercase tracking-wide px-1">
                {t("Нужно выделить миксер ({count})", { count: needDriver.length })}
              </div>
              {needDriver.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl p-4 border border-purple-200 shadow-sm space-y-2">
                  {renderHead(o)}
                  {renderInfo(o, true)}
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button
                      onClick={() => setAssignOrder(o)}
                      className="text-sm font-bold py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 inline-flex items-center justify-center gap-1"
                    >
                      <Send className="w-4 h-4" />
                      {t("Выделить миксер(ы)")}
                    </button>
                    <button
                      onClick={() => giveBack(o)}
                      disabled={busy === o.id}
                      className="px-3 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-50"
                      title={t("Вернуть в общую ленту")}
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {working.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
                {t("В работе ({count})", { count: working.length })}
              </div>
              {working.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm space-y-2">
                  {renderHead(o)}
                  {renderInfo(o, true)}
                  <div className="flex items-center justify-between gap-2 text-sm bg-neutral-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5 font-semibold text-neutral-800 min-w-0">
                      <Truck className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span className="truncate">{o.driver_name || t("Водитель")}</span>
                    </span>
                    <button
                      onClick={() => setAssignOrder(o)}
                      className="shrink-0 text-xs font-bold text-blue-600 inline-flex items-center gap-1"
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      {t("Сменить")}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setStatus(o, "manufacturing")}
                      disabled={busy === o.id || o.status === "manufacturing" || o.status === "en_route"}
                      className="text-xs font-bold py-2.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                    >
                      <Droplets className="w-3.5 h-3.5" />
                      {t("Начать заливку")}
                    </button>
                    <button
                      onClick={() => setStatus(o, "en_route")}
                      disabled={busy === o.id || o.status === "en_route"}
                      className="text-xs font-bold py-2.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {t("Миксер выехал")}
                    </button>
                  </div>
                  {o.driver_paid ? (
                    <div className="text-xs font-bold py-2 rounded-lg bg-amber-100 text-amber-700 inline-flex w-full items-center justify-center gap-1">
                      <Hourglass className="w-3.5 h-3.5" />
                      {t("Миксерист оплатил сбор — ждёт подтверждения админом")}
                    </div>
                  ) : (
                    <div className="text-[11px] text-neutral-400 text-center">
                      {t("Заказ закроется, когда миксерист оплатит сбор и админ подтвердит оплату")}
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/order/${o.id}`)}
                    className="w-full text-xs font-bold py-2 rounded-lg bg-neutral-900 text-white"
                  >
                    {t("Открыть заявку и чат")}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
              {t("Свободные заявки клиентов ({count})", { count: free.length })}
            </div>
            {free.length === 0 ? (
              <div className="text-center py-10 text-neutral-400">
                <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t("Пока нет свободных заказов")}</p>
                <p className="text-xs mt-1">{t("Новые заявки появятся здесь автоматически")}</p>
              </div>
            ) : (
              free.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-2">
                  {renderHead(o)}
                  {renderInfo(o, false)}
                  <button
                    onClick={() => take(o)}
                    disabled={busy === o.id}
                    className="w-full text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                  >
                    {busy === o.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Factory className="w-4 h-4" />
                        {t("Принять заявку на завод")}
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          {done.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
                {t("Недавно завершённые")}
              </div>
              {done.map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate(`/order/${o.id}`)}
                  className="w-full text-left bg-white rounded-xl p-3 border border-neutral-200 flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-neutral-700 truncate">
                    {o.order_number ? `${o.order_number} · ` : ""}
                    {o.what_needed}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-green-600 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {o.driver_name || ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <AssignFleetDriverDialog
        plantId={user?.id}
        order={assignOrder}
        open={!!assignOrder}
        onOpenChange={(v) => !v && setAssignOrder(null)}
        onAssigned={load}
      />
    </div>
  );
}
