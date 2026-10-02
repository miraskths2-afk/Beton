import React, { useEffect, useState } from "react";
import { Timer, Construction, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, locale } from "@/lib/i18n";
import { distanceKm, formatKm } from "@/lib/geo";
import {
  PUMP_MIN_HOURS,
  pumpBilledHours,
  pumpFinalTotal,
  pumpServiceFee,
  pumpStart,
  pumpFinish,
  pumpErrorText,
} from "@/lib/pump";

// Дальше этого расстояния от объекта таймер не запускается.
const MAX_ARRIVE_KM = 1;

function fmtDuration(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
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

// Таймер работы АБН. Время насоса идёт с момента, как он встал на лапы
// (насосник нажимает сам, или таймер запускается сам, когда насосник
// стоит на объекте — см. lib/autoArrival.js).
// role: "driver" — насосник этой заявки (запускает и останавливает),
//       "client" — заказчик, "admin", "plant" — только смотрят.
export default function PumpWorkTimer({ o, role, userId, onChanged, className }) {
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
      setError(pumpErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      if (o.delivery_lat != null && o.delivery_lng != null) {
        const pos = await getPosition();
        if (pos) {
          const km = distanceKm(pos.lat, pos.lng, o.delivery_lat, o.delivery_lng);
          if (km != null && km > MAX_ARRIVE_KM) {
            throw new Error(
              t("Вы в {dist} от объекта. Таймер насоса запускается только на объекте.", {
                dist: formatKm(km),
              })
            );
          }
        }
      }
      await pumpStart(userId, o.id);
    });

  const finish = () => {
    if (!confirm(t("Подача бетона закончена? Таймер насоса остановится."))) return;
    run(() => pumpFinish(userId, o.id));
  };

  const money = (n) => `${Number(n || 0).toLocaleString(locale())} ₸`;
  const fmtTime = (v) =>
    new Date(v).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  const end = o.unloaded_at ? new Date(o.unloaded_at).getTime() : now;
  const elapsed = o.arrived_at ? end - new Date(o.arrived_at).getTime() : 0;
  const billed = pumpBilledHours(o, now);
  const total = pumpFinalTotal({ ...o, pump_hours_actual: o.pump_hours_actual || billed });
  const fee = pumpServiceFee({ ...o, pump_hours_actual: o.pump_hours_actual || billed });
  const showFee = role === "driver" || role === "admin" || role === "plant";

  return (
    <div className={cn("rounded-xl border border-sky-200 bg-white p-3 space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wide">
        <Timer className="w-4 h-4" />
        {t("Время работы насоса")}
      </div>

      {!o.arrived_at ? (
        <>
          <div className="text-[11px] text-neutral-500">
            {t("Нажмите, когда насос встанет на лапы. Если забудете — таймер запустится сам, когда вы будете на объекте. Оплата — минимум {n} часа, дальше каждый начатый час.", { n: PUMP_MIN_HOURS })}
          </div>
          <button
            onClick={start}
            disabled={busy}
            className="w-full text-sm font-bold py-2.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Construction className="w-4 h-4" />}
            {t("Насос встал на лапы — запустить таймер")}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-black tabular-nums text-neutral-900">{fmtDuration(elapsed)}</div>
              <div className="text-[11px] text-neutral-500">
                {t("Насос работает с {time}", { time: fmtTime(o.arrived_at) })}
                {o.unloaded_at ? ` · ${t("закончил в {time}", { time: fmtTime(o.unloaded_at) })}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-neutral-500">{t("К оплате часов: {n}", { n: billed })}</div>
              {total ? <div className="text-base font-black text-neutral-900">{money(total)}</div> : null}
            </div>
          </div>
          {showFee && (
            <div className="text-[11px] text-neutral-500">
              {t("Сбор сайта: {fee} ({n} ч × {rate})", {
                fee: money(fee),
                n: billed,
                rate: money(o.pump_fee_rate ?? fee / billed),
              })}
            </div>
          )}

          {running && role === "driver" && (
            <button
              onClick={finish}
              disabled={busy}
              className="w-full text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t("Подачу закончил — остановить таймер")}
            </button>
          )}
        </>
      )}

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}
    </div>
  );
}
