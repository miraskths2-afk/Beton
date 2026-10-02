import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { normPhone } from "@/lib/orderStatuses";
import { Flame, MapPin, CheckCircle2, Loader2, Package } from "lucide-react";
import ChatButton from "@/components/ChatButton";
import { cn } from "@/lib/utils";
import { t, locale } from "@/lib/i18n";

export default function MyIntercepts({ phone }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const all = await base44.entities.Leftover.list("-created_date", 300);
      const mine = all.filter(
        (l) => normPhone(l.intercepted_by_phone) === normPhone(phone)
      );
      setItems(mine);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }
    load();
    const unsub = base44.entities.Leftover.subscribe(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  if (loading) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{t("Вы пока ничего не перехватывали в Кубовике")}</p>
      </div>
    );
  }

  const fmtDate = (d) =>
    new Date(d).toLocaleString(locale(), {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-2">
      {items.map((l) => {
        const isGone = l.status === "gone";
        return (
          <div
            key={l.id}
            className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                {l.grade} · {t("{n} куб", { n: l.cubes })}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-bold",
                  isGone
                    ? "bg-neutral-200 text-neutral-500"
                    : "bg-green-100 text-green-700"
                )}
              >
                {isGone ? t("Завершено") : t("В процессе")}
              </span>
            </div>
            <div className="text-xs text-neutral-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {l.direction}
            </div>
            <div className="text-sm font-black text-orange-600">
              {l.price?.toLocaleString(locale())} ₸
            </div>
            <ChatButton
              kind="leftover"
              id={l.id}
              item={l}
              role="client"
              compact
              label={t("Написать миксеристу{name}", {
                name: l.driver_name ? ` · ${l.driver_name}` : "",
              })}
            />
            {isGone && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("Забрано {date}", { date: fmtDate(l.created_date) })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
