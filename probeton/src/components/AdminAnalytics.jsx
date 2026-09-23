import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Trophy } from "lucide-react";

const DAYS = 14;

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export default function AdminAnalytics() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("orders"); // "orders" | "revenue"

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.Order.list("-created_date", 1000);
        setOrders(all.filter((o) => o.status === "done"));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-6 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  // Последние 14 дней, включая сегодня.
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return dayKey(d);
  });

  const byDay = {};
  for (const day of days) byDay[day] = { count: 0, revenue: 0 };
  for (const o of orders) {
    const key = dayKey(o.completed_at || o.created_date);
    if (byDay[key]) {
      byDay[key].count += 1;
      byDay[key].revenue += (o.cubes || 0) * 1000;
    }
  }

  const values = days.map((d) =>
    metric === "orders" ? byDay[d].count : byDay[d].revenue
  );
  const max = Math.max(1, ...values);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + (o.cubes || 0) * 1000, 0);

  // Топ-5 водителей по кубам за всё время.
  const byDriver = {};
  for (const o of orders) {
    if (!o.driver_id) continue;
    if (!byDriver[o.driver_id]) {
      byDriver[o.driver_id] = { name: o.driver_name || "Водитель", cubes: 0, count: 0 };
    }
    byDriver[o.driver_id].cubes += o.cubes || 0;
    byDriver[o.driver_id].count += 1;
  }
  const topDrivers = Object.values(byDriver)
    .sort((a, b) => b.cubes - a.cubes)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400 px-1">За последние 14 дней</p>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMetric("orders")}
            className={`text-xs font-bold py-2 rounded-lg ${
              metric === "orders"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Заказы ({totalOrders})
          </button>
          <button
            onClick={() => setMetric("revenue")}
            className={`text-xs font-bold py-2 rounded-lg ${
              metric === "revenue"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Выручка ({totalRevenue.toLocaleString("ru-RU")} ₸)
          </button>
        </div>

        <div className="flex items-end gap-1 h-28 pt-2">
          {days.map((d, i) => {
            const v = values[i];
            const heightPct = Math.max(4, Math.round((v / max) * 100));
            const isToday = i === days.length - 1;
            return (
              <div
                key={d}
                className="flex-1 h-full flex flex-col items-center justify-end gap-1 group relative"
              >
                <div
                  className={`w-full rounded-t transition-all ${
                    isToday ? "bg-amber-500" : "bg-neutral-800"
                  }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${d}: ${v}${metric === "revenue" ? " ₸" : ""}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-neutral-400 px-0.5">
          <span>{days[0].slice(5)}</span>
          <span>сегодня</span>
        </div>
      </div>

      {topDrivers.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase tracking-wide">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            Топ водителей
          </div>
          {topDrivers.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-semibold text-neutral-800">{d.name}</span>
              </div>
              <span className="text-neutral-500 text-xs">
                {d.count} заказ(ов) · {d.cubes} куб
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
