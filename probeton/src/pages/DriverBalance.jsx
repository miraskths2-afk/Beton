import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle2, Loader2, BarChart3, Wallet } from "lucide-react";

export default function DriverBalance() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.Order.list("-created_date", 200);
        setOrders(all);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const done = orders.filter(
    (o) => o.driver_id === user?.id && o.status === "done"
  );
  const active = orders.filter(
    (o) => o.driver_id === user?.id && o.status !== "done"
  );
  const totalSum = done.reduce((sum, o) => sum + (o.cubes || 0) * 1000, 0);
  const totalCubes = done.reduce((sum, o) => sum + (o.cubes || 0), 0);

  const fmtDate = (d) =>
    new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="p-4 space-y-5">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">Статистика</h1>
        <p className="text-sm text-neutral-500">
          {user?.full_name || user?.driver_name || "Водитель"}
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white p-5 shadow-md">
        <div className="flex items-center gap-2 text-neutral-300 text-sm">
          <Wallet className="w-4 h-4" />
          Сумма выполненных заявок
        </div>
        <div className="text-4xl font-black mt-2 tabular-nums">
          {totalSum.toLocaleString("ru-RU")} ₸
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-2">
          <BarChart3 className="w-3.5 h-3.5" />
          {totalCubes} куб всего · 1 000 ₸ за куб
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-black text-neutral-900 tabular-nums">
            {done.length}
          </div>
          <div className="text-xs text-neutral-500 font-semibold mt-0.5">
            Заявок выполнено
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-black text-neutral-900 tabular-nums">
            {active.length}
          </div>
          <div className="text-xs text-neutral-500 font-semibold mt-0.5">
            В работе сейчас
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1 mb-2">
          Выполненные заявки
        </div>
        {loading ? (
          <div className="text-center py-10 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : done.length === 0 ? (
          <div className="text-center py-10 text-neutral-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Завершённых заявок пока нет</p>
          </div>
        ) : (
          <div className="space-y-2">
            {done.map((o) => (
              <div
                key={o.id}
                className="bg-white rounded-xl border border-neutral-200 p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <div>
                    <div className="text-sm font-semibold text-neutral-800">
                      {o.order_number || "Заявка"}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {o.cubes ? `${o.cubes} куб · ` : ""}
                      {fmtDate(o.completed_at || o.created_date)}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-black text-neutral-900 tabular-nums">
                  {((o.cubes || 0) * 1000).toLocaleString("ru-RU")} ₸
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
