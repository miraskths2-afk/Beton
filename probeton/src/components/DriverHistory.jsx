import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Truck } from "lucide-react";

export default function DriverHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDriver, setOpenDriver] = useState(null);

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 500);
      setOrders(all.filter((o) => o.status === "done" && o.driver_id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
  }, []);

  const fmtDate = (d) =>
    new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  const byDriver = {};
  for (const o of orders) {
    const key = o.driver_id;
    if (!byDriver[key]) {
      byDriver[key] = {
        driver_id: key,
        driver_name: o.driver_name || "Водитель",
        orders: [],
        totalCubes: 0,
      };
    }
    byDriver[key].orders.push(o);
    byDriver[key].totalCubes += o.cubes || 0;
  }
  const drivers = Object.values(byDriver).sort(
    (a, b) => b.orders.length - a.orders.length
  );

  if (drivers.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Пока нет завершённых заказов</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drivers.map((d) => (
        <div
          key={d.driver_id}
          className="border border-neutral-200 rounded-xl overflow-hidden"
        >
          <button
            onClick={() =>
              setOpenDriver(openDriver === d.driver_id ? null : d.driver_id)
            }
            className="w-full flex items-center justify-between p-3 bg-neutral-50"
          >
            <div className="text-left">
              <div className="font-bold text-sm text-neutral-900">
                {d.driver_name}
              </div>
              <div className="text-xs text-neutral-500">
                {d.orders.length} заказ(ов) · {d.totalCubes} куб всего
              </div>
            </div>
            {openDriver === d.driver_id ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
          {openDriver === d.driver_id && (
            <div className="p-3 space-y-2 border-t border-neutral-100">
              {d.orders.map((o) => (
                <div
                  key={o.id}
                  className="bg-white rounded-lg p-2.5 border border-neutral-100 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-bold text-green-600">
                      <CheckCircle2 className="w-3 h-3" />
                      {o.order_number || "Заказ"}
                    </span>
                    <span className="text-neutral-400">
                      {fmtDate(o.created_date)}
                    </span>
                  </div>
                  <div className="text-neutral-700">{o.what_needed}</div>
                  {o.delivery_address && (
                    <div className="text-neutral-500">
                      Адрес: {o.delivery_address}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
