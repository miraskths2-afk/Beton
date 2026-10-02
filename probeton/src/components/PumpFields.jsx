import React from "react";
import { Minus, Plus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { formatTenge } from "@/lib/balance";
import { PUMP_BOOMS, PUMP_BOOM_HINTS, PUMP_MIN_HOURS, pumpRateFor } from "@/lib/pump";

// Выбор АБН: длина стрелы + сколько часов (минимум 3) + сколько платить
// сразу. Используется в отдельной вкладке «АБН» и в заказе бетона,
// когда выгрузка — автобетононасосом.
export default function PumpFields({ boom, onBoom, hours, onHours, settings }) {
  const rate = boom ? pumpRateFor(settings, boom) : null;
  const h = Math.max(PUMP_MIN_HOURS, Number(hours) || PUMP_MIN_HOURS);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-sm font-semibold text-neutral-700">
          {t("Длина стрелы АБН")} <span className="text-red-500">*</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {PUMP_BOOMS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onBoom(b)}
              className={cn(
                "h-11 rounded-xl text-sm font-bold border transition-colors",
                boom === b
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-neutral-700 border-neutral-200"
              )}
            >
              {b} м
            </button>
          ))}
        </div>
        {boom && PUMP_BOOM_HINTS[boom] && (
          <p className="text-xs text-neutral-500 px-1">{t(PUMP_BOOM_HINTS[boom])}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-neutral-700">{t("Сколько часов нужен насос")}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onHours(String(Math.max(PUMP_MIN_HOURS, h - 1)))}
            disabled={h <= PUMP_MIN_HOURS}
            className="w-11 h-11 rounded-xl border border-neutral-200 flex items-center justify-center disabled:opacity-40"
            aria-label={t("Меньше")}
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="flex-1 h-11 rounded-xl bg-neutral-100 flex items-center justify-center text-lg font-black tabular-nums">
            {t("{n} ч", { n: h })}
          </div>
          <button
            type="button"
            onClick={() => onHours(String(Math.min(24, h + 1)))}
            className="w-11 h-11 rounded-xl border border-neutral-200 flex items-center justify-center"
            aria-label={t("Больше")}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold">
            {t("Минимальный заказ АБН — {n} часа. Эти {n} часа оплачиваются сразу.", { n: PUMP_MIN_HOURS })}
          </div>
          <div>
            {rate
              ? t("{rate} за час · оплатить сразу: {sum}", {
                  rate: formatTenge(rate),
                  sum: formatTenge(rate * h),
                })
              : t("Цена за час для этой стрелы уточняется — насосник напишет в чате.")}
          </div>
          <div className="text-sky-700">
            {t("Если насос работает дольше — доплата по часам после работы.")}
          </div>
        </div>
      </div>
    </div>
  );
}
