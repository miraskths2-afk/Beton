import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Timer, MapPinned, CheckCircle2, Loader2, Hourglass, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, locale } from "@/lib/i18n";
import { distanceKm, formatKm } from "@/lib/geo";
import {
  downtimeNow,
  markArrived,
  finishUnloading,
  orderDetailsErrorText,
} from "@/lib/orderExtras";

// Дальше этого расстояния от точки объекта таймер не запускается.
const MAX_ARRIVE_KM = 1;

function fmtDuration(minutes) {
  const total = Math.floor(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

// Таймер простоя миксера на объекте.
// role: "driver" — миксерист этого заказа (запускает и останавливает),
//       "client" — заказчик (видит таймер, отмечает оплату простоя),
//       "admin"  — диспетчер (может подтвердить оплату простоя),
//       "view"   — остальные только смотрят.
export default function DowntimeTimer({ o, role, userId, onChanged, className }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const running = !!o?.arrived_at && !o?.unloaded_at;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!o) return null;
  const isClosed = o.status === "done" || o.status === "cancelled";
  if (!o.arrived_at && (role !== "driver" || isClosed)) return null;

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(orderDetailsErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const arrive = () =>
    run(async () => {
      if (o.delivery_lat != null && o.delivery_lng != null) {
        const pos = await getPosition();
        if (pos) {
          const km = distanceKm(pos.lat, pos.lng, o.delivery_lat, o.delivery_lng);
          if (km != null && km > MAX_ARRIVE_KM) {
            throw new Error(
              t("Вы в {dist} от объекта. Таймер простоя запускается только на объекте.", {
                dist: formatKm(km),
              })
            );
          }
        }
      }
      await markArrived(userId, o.id);
    });

  const finish = () => {
    if (!confirm(t("Выгрузка закончена? Таймер простоя остановится."))) return;
    run(() => finishUnloading(userId, o.id));
  };

  const markPaid = () => {
    if (!confirm(t("Подтвердите, что оплатили простой миксеристу."))) return;
    run(() => base44.entities.Order.update(o.id, { downtime_client_paid: true }));
  };

  const confirmPaid = () => {
    if (!confirm(t("Подтвердите, что миксерист получил оплату за простой."))) return;
    run(() => base44.entities.Order.update(o.id, { downtime_paid_confirmed: true }));
  };

  const free = o.downtime_free_minutes ?? 60;
  const rate = Number(o.downtime_rate || 0);
  const d = downtimeNow(o, now);
  const fee = o.unloaded_at ? Number(o.downtime_fee || 0) : d.fee;
  const hours = o.unloaded_at ? o.downtime_hours || 0 : d.hours;
  const overFree = d.minutes > free;
  const money = (n) => `${Number(n || 0).toLocaleString(locale())} ₸`;
  const fmtTime = (v) =>
    new Date(v).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={cn(
        "rounded-xl border p-3 space-y-2",
        running && overFree ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wide">
        <Timer className="w-4 h-4" />
        {t("Простой на объекте")}
      </div>

      {!o.arrived_at ? (
        <>
          <div className="text-[11px] text-neutral-500">
            {t("Нажмите, когда подъедете к объекту. Если забудете — таймер запустится сам, когда вы будете на объекте. Первые {free} мин бесплатно, дальше клиент платит за каждый начатый час.", { free })}
          </div>
          <button
            onClick={arrive}
            disabled={busy}
            className="w-full text-sm font-bold py-2.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPinned className="w-4 h-4" />}
            {t("Я на объекте — запустить таймер")}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div
                className={cn(
                  "text-2xl font-black tabular-nums",
                  overFree ? "text-red-600" : "text-neutral-900"
                )}
              >
                {fmtDuration(d.minutes)}
              </div>
              <div className="text-[11px] text-neutral-500">
                {t("На объекте с {time}", { time: fmtTime(o.arrived_at) })}
                {o.unloaded_at ? ` · ${t("выгрузка закончена в {time}", { time: fmtTime(o.unloaded_at) })}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-neutral-500">
                {t("Платных часов: {n}", { n: hours })}
              </div>
              <div className={cn("text-base font-black", fee > 0 ? "text-red-600" : "text-green-600")}>
                {money(fee)}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-neutral-500">
            {t("Бесплатно {free} мин, дальше {rate} за каждый начатый час — оплачивает клиент миксеристу.", {
              free,
              rate: money(rate),
            })}
          </div>

          {running && role === "driver" && (
            <button
              onClick={finish}
              disabled={busy}
              className="w-full text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t("Выгрузка закончена")}
            </button>
          )}

          {o.unloaded_at && fee <= 0 && (
            <div className="text-xs font-bold text-green-700 bg-green-100 rounded-lg px-3 py-2 text-center">
              {t("Уложились в бесплатное время — доплаты нет")}
            </div>
          )}

          {o.unloaded_at && fee > 0 && (
            o.downtime_paid_confirmed ? (
              <div className="text-xs font-bold text-green-700 bg-green-100 rounded-lg px-3 py-2 inline-flex w-full items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {t("Простой оплачен")}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {t("Клиент оплачивает миксеристу простой: {fee} ({hours} ч × {rate})", {
                    fee: money(fee),
                    hours,
                    rate: money(rate),
                  })}
                </div>
                {o.downtime_client_paid ? (
                  <div className="text-xs font-bold text-amber-700 bg-amber-100 rounded-lg px-3 py-2 inline-flex w-full items-center justify-center gap-1">
                    <Hourglass className="w-4 h-4" />
                    {t("Клиент отметил оплату — ждём подтверждения миксериста")}
                  </div>
                ) : (
                  role === "client" && (
                    <button
                      onClick={markPaid}
                      disabled={busy}
                      className="w-full text-sm font-bold py-2.5 rounded-lg bg-amber-400 text-neutral-900 hover:bg-amber-300 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                      {t("Я оплатил простой миксеристу")}
                    </button>
                  )
                )}
                {(role === "driver" || role === "admin") && (
                  <button
                    onClick={confirmPaid}
                    disabled={busy}
                    className="w-full text-xs font-bold py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {role === "admin" ? t("Подтвердить оплату простоя") : t("Оплату за простой получил")}
                  </button>
                )}
              </div>
            )
          )}
        </>
      )}

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}
    </div>
  );
}
