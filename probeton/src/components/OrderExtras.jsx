import React from "react";
import { Truck, Droplets, Repeat, FileText, Camera, Layers, Construction, Clock, Wallet, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { trucksEstimate, trucksText, unloadText } from "@/lib/orderExtras";
import { isPumpOrder, pumpTitle, pumpPrepay, PUMP_MIN_HOURS } from "@/lib/pump";
import { formatTenge } from "@/lib/balance";

// Подробности заявки одной строкой значков: способ выгрузки, лоток,
// примерное число машин, дозаказ, «с документами», рейс, фото заезда.
// Используется в карточках заявок у всех ролей.
export default function OrderExtras({ o, showPhoto = true, className }) {
  if (!o) return null;
  const isTrip = o.trips_total > 1;
  const trucks = isTrip ? 0 : trucksEstimate(o.cubes);
  const unload = unloadText(o);

  const chip = "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold";

  // Заявка на АБН: длина стрелы, часы, цена, предоплата.
  if (isPumpOrder(o)) {
    const prepay = pumpPrepay(o);
    return (
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        <span className={cn(chip, "bg-sky-100 text-sky-700")}>
          <Construction className="w-3 h-3" />
          {pumpTitle(o.pump_boom)}
        </span>
        <span className={cn(chip, "bg-neutral-100 text-neutral-700")}>
          <Clock className="w-3 h-3" />
          {t("{n} ч (минимум {min})", { n: o.pump_hours || PUMP_MIN_HOURS, min: PUMP_MIN_HOURS })}
        </span>
        <span className={cn(chip, "bg-neutral-100 text-neutral-700")}>
          <Wallet className="w-3 h-3" />
          {o.pump_rate
            ? t("{rate}/ч · сразу {sum}", { rate: formatTenge(o.pump_rate), sum: formatTenge(prepay) })
            : t("Цена за час уточняется")}
        </span>
        {o.pump_prepaid_confirmed ? (
          <span className={cn(chip, "bg-green-100 text-green-700")}>{t("Предоплата получена")}</span>
        ) : o.pump_prepaid ? (
          <span className={cn(chip, "bg-amber-100 text-amber-700")}>{t("Клиент оплатил — ждёт подтверждения")}</span>
        ) : (
          <span className={cn(chip, "bg-red-50 text-red-600")}>{t("Предоплата не внесена")}</span>
        )}
        {o.pump_for_order_id && (
          <span className={cn(chip, "bg-amber-50 text-amber-700")}>
            <Link2 className="w-3 h-3" />
            {t("К заявке на бетон")}
          </span>
        )}
        {o.pump_hire_open && (
          <span className={cn(chip, "bg-purple-100 text-purple-700")}>{t("Завод нанимает насос")}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {o.with_documents && (
          <span className={cn(chip, "bg-indigo-100 text-indigo-700")}>
            <FileText className="w-3 h-3" />
            {t("С документами")}
          </span>
        )}
        {isTrip ? (
          <span className={cn(chip, "bg-purple-100 text-purple-700")}>
            <Layers className="w-3 h-3" />
            {t("Машина {no} из {total}", { no: o.trip_no, total: o.trips_total })}
          </span>
        ) : (
          trucks > 0 && (
            <span className={cn(chip, "bg-neutral-100 text-neutral-700")}>
              <Truck className="w-3 h-3" />
              {t("Примерно {trucks}", { trucks: trucksText(trucks) })}
            </span>
          )
        )}
        {unload && (
          <span className={cn(chip, "bg-sky-100 text-sky-700")}>
            <Droplets className="w-3 h-3" />
            {unload}
          </span>
        )}
        {o.may_reorder && (
          <span className={cn(chip, "bg-amber-100 text-amber-700")}>
            <Repeat className="w-3 h-3" />
            {t("Возможен дозаказ")}
          </span>
        )}
        {o.reorder_of && (
          <span className={cn(chip, "bg-amber-50 text-amber-700")}>
            <Repeat className="w-3 h-3" />
            {t("Это дозаказ")}
          </span>
        )}
      </div>
      {showPhoto && o.site_photo_url && (
        <a
          href={o.site_photo_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 p-1.5 pr-3"
        >
          <img
            src={o.site_photo_url}
            alt=""
            loading="lazy"
            className="w-14 h-14 rounded-md object-cover shrink-0"
          />
          <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" />
            {t("Фото заезда на объект")}
          </span>
        </a>
      )}
      {!o.site_photo_url && o.access_confirmed && (
        <div className="text-[11px] text-neutral-500">
          {t("Фото заезда нет — клиент подтвердил, что заезд свободный и он обеспечит проезд миксера.")}
        </div>
      )}
    </div>
  );
}
