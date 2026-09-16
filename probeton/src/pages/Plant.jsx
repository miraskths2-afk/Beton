import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ORDER_STATUSES } from "@/lib/orderStatuses";
import { Button } from "@/components/ui/button";
import { Factory, Loader2, Droplets, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Plant() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      setOrders(
        all.filter(
          (o) => o.status === "sent_to_plant" || o.status === "manufacturing"
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
  }, []);

  const setStatus = async (id, status) => {
    try {
      await base44.entities.Order.update(id, { status });
      setOrders((prev) => {
        if (status === "en_route") return prev.filter((o) => o.id !== id);
        return prev.map((o) => (o.id === id ? { ...o, status } : o));
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="px-1 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
          <Factory className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-neutral-900">Диспетчерская завода</h1>
          <p className="text-sm text-neutral-500">Заказы в работе на РБУ</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Загрузка...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Factory className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Нет заказов, переданных на завод</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                    № заказа
                  </th>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                    Марка
                  </th>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                    Объём, куб
                  </th>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                    Адрес доставки
                  </th>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                    Подача миксера
                  </th>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                    Управление
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((o) => {
                  const st = ORDER_STATUSES[o.status];
                  return (
                    <tr key={o.id} className="align-top">
                      <td className="px-3 py-3 font-bold text-neutral-900 whitespace-nowrap">
                        {o.order_number || "—"}
                      </td>
                      <td className="px-3 py-3 font-semibold whitespace-nowrap">
                        {o.grade || "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        {o.cubes ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-neutral-700 max-w-[220px]">
                        {o.delivery_address || "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-neutral-700">
                        {o.mixer_time
                          ? new Date(o.mixer_time).toLocaleString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-2 min-w-[170px]">
                          <span
                            className={cn(
                              "inline-flex items-center w-fit px-2 py-1 rounded-lg text-xs font-bold",
                              st.cls
                            )}
                          >
                            {st.label}
                          </span>
                          <Button
                            size="sm"
                            disabled={o.status !== "sent_to_plant"}
                            onClick={() => setStatus(o.id, "manufacturing")}
                            className={cn(
                              "h-10 font-bold justify-start",
                              o.status === "sent_to_plant"
                                ? "bg-orange-500 hover:bg-orange-600 text-white"
                                : "bg-neutral-100 text-neutral-400"
                            )}
                          >
                            <Droplets className="w-4 h-4 mr-2" />
                            Начать заливку
                          </Button>
                          <Button
                            size="sm"
                            disabled={o.status !== "manufacturing"}
                            onClick={() => setStatus(o.id, "en_route")}
                            className={cn(
                              "h-10 font-bold justify-start",
                              o.status === "manufacturing"
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-neutral-100 text-neutral-400"
                            )}
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Миксер выехал
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
