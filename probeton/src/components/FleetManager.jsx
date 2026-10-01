import React, { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { Loader2, Phone, UserPlus, UserMinus, LogOut, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  fetchFleet,
  fetchDriverState,
  findUserByPhone,
  driverName,
  plantsErrorText,
} from "@/lib/plants";
import { setOffline } from "@/lib/driverLocation";

// Парк миксеристов одного завода. Используется и самим заводом
// (страница «Парк»), и админом (страница «Заводы»).
// Завод добавляет миксериста по номеру телефона, может снять его с
// линии и убрать из парка. Оплату по-прежнему подтверждает только админ.
export default function FleetManager({ plantId, isAdmin = false }) {
  const [fleet, setFleet] = useState([]);
  const [state, setState] = useState({ online: new Set(), busy: new Set() });
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const list = await fetchFleet(plantId);
      setFleet(list);
      setState(await fetchDriverState(list.map((d) => d.id)));
    } catch (e) {
      console.error(e);
      setError(t(plantsErrorText(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!plantId) return;
    load();
    const channel = supabase
      .channel(`realtime:fleet:${plantId}:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [plantId]);

  const addDriver = async (e) => {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      const u = await findUserByPhone(phone);
      if (!u) {
        setError(t("Миксерист с таким номером не найден. Пусть он сначала войдёт на сайт как водитель."));
        return;
      }
      if (u.account_type !== "driver") {
        setError(t("Этот номер зарегистрирован не как водитель."));
        return;
      }
      if (u.plant_id === plantId) {
        setError(t("Этот миксерист уже в парке."));
        return;
      }
      if (u.plant_id) {
        if (!isAdmin) {
          setError(t("Этот миксерист уже в парке другого завода. Перевести его может админ."));
          return;
        }
        if (!confirm(t("Миксерист уже в парке другого завода. Перевести его в этот парк?"))) return;
      }
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ plant_id: plantId })
        .eq("id", u.id);
      if (upErr) throw upErr;
      setPhone("");
      await load();
    } catch (err) {
      console.error(err);
      setError(t(plantsErrorText(err)));
    } finally {
      setAdding(false);
    }
  };

  const removeDriver = async (d) => {
    if (!confirm(t("Убрать «{name}» из парка? Он станет независимым миксеристом.", { name: driverName(d) }))) return;
    setBusyId(d.id);
    try {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ plant_id: null })
        .eq("id", d.id);
      if (upErr) throw upErr;
      setFleet((prev) => prev.filter((x) => x.id !== d.id));
    } catch (err) {
      console.error(err);
      setError(t(plantsErrorText(err)));
    } finally {
      setBusyId(null);
    }
  };

  const takeOffLine = async (d) => {
    setBusyId(d.id);
    try {
      await setOffline(d.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const onlineCount = fleet.filter((d) => state.online.has(d.id)).length;

  return (
    <div className="space-y-3">
      <form onSubmit={addDriver} className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("Номер миксериста")}
          className="flex-1 min-w-0 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={adding || phone.replace(/\D/g, "").length < 10}
          className="shrink-0 px-3 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {t("Добавить")}
        </button>
      </form>

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-6 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : fleet.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
          <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          {t("В парке пока нет миксеристов")}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-neutral-500 px-1">
            {t("В парке: {n} · на линии: {online}", { n: fleet.length, online: onlineCount })}
          </div>
          {fleet.map((d) => {
            const online = state.online.has(d.id);
            const busy = state.busy.has(d.id);
            return (
              <div
                key={d.id}
                className="bg-white rounded-xl p-3 border border-neutral-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-neutral-900 truncate">{driverName(d)}</div>
                  <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-x-2">
                    {d.vehicle_plate && <span>{d.vehicle_plate}</span>}
                    <span className={cn("font-semibold", online ? "text-green-600" : "text-neutral-400")}>
                      {online ? t("На линии") : t("Не на линии")}
                    </span>
                    {busy && <span className="font-semibold text-amber-600">{t("Занят заказом")}</span>}
                    {d.approval_status !== "approved" && (
                      <span className="font-semibold text-red-500">{t("Не одобрен")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {d.phone && (
                    <a
                      href={`tel:${d.phone}`}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                      title={t("Позвонить")}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {online && (
                    <button
                      onClick={() => takeOffLine(d)}
                      disabled={busyId === d.id}
                      className="p-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40"
                      title={t("Убрать с линии")}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => removeDriver(d)}
                    disabled={busyId === d.id}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                    title={t("Убрать из парка")}
                  >
                    {busyId === d.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserMinus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
