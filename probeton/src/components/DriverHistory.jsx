import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  Truck,
  EyeOff,
  Eye,
  Trash2,
} from "lucide-react";

export default function DriverHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDriver, setOpenDriver] = useState(null);
  const [showHidden, setShowHidden] = useState(false);
  const [busyId, setBusyId] = useState(null);

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

  const toggleHide = async (id, hidden) => {
    setBusyId(id);
    try {
      await base44.entities.Order.update(id, { hidden_from_history: !hidden });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const removeRecord = async (id) => {
    if (!confirm("Удалить эту запись из истории безвозвратно?")) return;
    setBusyId(id);
    try {
      await base44.entities.Order.delete(id);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  const visibleOrders = orders.filter(
    (o) => showHidden || !o.hidden_from_history
  );
  const hiddenCount = orders.filter((o) => o.hidden_from_history).length;

  const byDriver = {};
  for (const o of visibleOrders) {
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

  return (
    <div className="space-y-3">
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowHidden((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-700"
        >
          {showHidden ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              Скрыть скрытые записи ({hiddenCount})
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              Показать скрытые записи ({hiddenCount})
            </>
          )}
        </button>
      )}

      {drivers.length === 0 ? (
        <div className="text-center py-8 text-neutral-400">
          <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Пока нет завершённых заказов</p>
        </div>
      ) : (
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
                      className={`bg-white rounded-lg p-2.5 border text-xs space-y-1.5 ${
                        o.hidden_from_history
                          ? "border-dashed border-neutral-300 opacity-60"
                          : "border-neutral-100"
                      }`}
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
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => toggleHide(o.id, o.hidden_from_history)}
                          disabled={busyId === o.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 font-semibold"
                        >
                          {o.hidden_from_history ? (
                            <>
                              <Eye className="w-3 h-3" />
                              Показать
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Скрыть
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => removeRecord(o.id)}
                          disabled={busyId === o.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 font-semibold"
                        >
                          <Trash2 className="w-3 h-3" />
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
