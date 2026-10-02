import React, { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { Loader2, Phone, UserPlus, UserMinus, LogOut, LogIn, Truck, Hourglass, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  fetchFleet,
  fetchFleetRequests,
  putOnLine,
  fetchDriverState,
  findUserByPhone,
  driverName,
  plantsErrorText,
} from "@/lib/plants";
import { setOffline } from "@/lib/driverLocation";
import { pumpErrorText, pumpTitle } from "@/lib/pump";

// Парк одного завода: миксеристы и насосники АБН. Используется и самим заводом
// (страница «Парк»), и админом (страница «Заводы»).
// Завод добавляет миксериста по номеру телефона (в парк он попадает
// после одобрения админом), ставит на линию и снимает с неё, убирает
// из парка. На карте завод своих миксеристов здесь не видит — только
// отметку «на линии». Админ добавляет в парк сразу, без запроса.
// Оплату по-прежнему подтверждает только админ.
export default function FleetManager({ plantId, isAdmin = false }) {
  const [fleet, setFleet] = useState([]);
  const [requests, setRequests] = useState([]);
  const [state, setState] = useState({ online: new Set(), busy: new Set() });
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const [list, reqs] = await Promise.all([fetchFleet(plantId), fetchFleetRequests(plantId)]);
      setFleet(list);
      setRequests(reqs);
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
    setNotice("");
    setAdding(true);
    try {
      const u = await findUserByPhone(phone);
      if (!u) {
        setError(t("Миксерист или насосник с таким номером не найден. Пусть он сначала войдёт на сайт как водитель или насосник."));
        return;
      }
      if (u.account_type !== "driver" && u.account_type !== "pump") {
        setError(t("Этот номер зарегистрирован не как миксерист или насосник."));
        return;
      }
      if (u.plant_id === plantId) {
        setError(t("Этот миксерист уже в парке."));
        return;
      }
      if (!isAdmin && u.plant_request_id === plantId) {
        setError(t("Запрос на этого миксериста уже отправлен админу."));
        return;
      }
      if (u.plant_id) {
        if (!isAdmin) {
          setError(t("Этот миксерист уже в парке другого завода. Перевести его может админ."));
          return;
        }
        if (!confirm(t("Миксерист уже в парке другого завода. Перевести его в этот парк?"))) return;
      }
      // Завод отправляет запрос — в парк миксерист попадёт после
      // одобрения админом. Админ добавляет сразу.
      const { error: upErr } = await supabase
        .from("app_users")
        .update(
          isAdmin
            ? { plant_id: plantId, plant_request_id: null }
            : { plant_request_id: plantId }
        )
        .eq("id", u.id);
      if (upErr) throw upErr;
      setPhone("");
      if (!isAdmin) setNotice(t("Запрос отправлен. Миксерист появится в парке после одобрения админом."));
      await load();
    } catch (err) {
      console.error(err);
      setError(pumpErrorText(t(plantsErrorText(err))));
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

  const cancelRequest = async (d) => {
    setBusyId(d.id);
    try {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ plant_request_id: null })
        .eq("id", d.id)
        .eq("plant_request_id", plantId);
      if (upErr) throw upErr;
      setRequests((prev) => prev.filter((x) => x.id !== d.id));
    } catch (err) {
      console.error(err);
      setError(t(plantsErrorText(err)));
    } finally {
      setBusyId(null);
    }
  };

  const bringOnLine = async (d) => {
    setBusyId(d.id);
    setError("");
    try {
      const ok = await putOnLine(d.id);
      if (!ok) {
        setError(t("«{name}» ещё ни разу не выходил на линию — пусть сначала включит линию на своём телефоне.", { name: driverName(d) }));
      }
      await load();
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
          placeholder={t("Номер миксериста или насосника")}
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
      {notice && (
        <div className="text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2">{notice}</div>
      )}

      {requests.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-amber-600 px-1">
            {t("Ждут одобрения админа ({n})", { n: requests.length })}
          </div>
          {requests.map((d) => (
            <div
              key={d.id}
              className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-neutral-900 truncate">{driverName(d)}</div>
                  <div className="text-xs text-neutral-500">{d.vehicle_plate || d.phone}</div>
                </div>
              </div>
              <button
                onClick={() => cancelRequest(d)}
                disabled={busyId === d.id}
                className="p-2 rounded-lg bg-white text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 shrink-0"
                title={t("Отменить запрос")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : fleet.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
          <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          {t("В парке пока нет миксеристов и насосников")}
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
                    <span
                      className={cn(
                        "font-bold",
                        d.account_type === "pump" ? "text-sky-700" : "text-neutral-700"
                      )}
                    >
                      {d.account_type === "pump"
                        ? d.pump_boom
                          ? pumpTitle(d.pump_boom)
                          : t("Насосник")
                        : t("Миксерист")}
                    </span>
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
                  {online ? (
                    <button
                      onClick={() => takeOffLine(d)}
                      disabled={busyId === d.id}
                      className="p-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40"
                      title={t("Убрать с линии")}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => bringOnLine(d)}
                      disabled={busyId === d.id}
                      className="p-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40"
                      title={t("Поставить на линию")}
                    >
                      <LogIn className="w-4 h-4" />
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
