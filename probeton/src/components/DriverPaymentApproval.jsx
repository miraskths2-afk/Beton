import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BadgeCheck, Loader2, Truck } from "lucide-react";

export default function DriverPaymentApproval() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      setOrders(
        all.filter(
          (o) => o.driver_paid && !o.driver_payment_confirmed && o.status !== "done"
        )
      );
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

  const approve = async (id) => {
    setBusy(id);
    try {
      // Подтверждаем оплату сбора водителем и одновременно завершаем заказ —
      // именно оплата является условием, при котором заказ можно закрыть.
      await base44.entities.Order.update(id, {
        driver_payment_confirmed: true,
        status: "done",
        completed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return null;
  if (orders.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Truck className="w-4 h-4 text-green-600" />
        <h2 className="text-sm font-black text-neutral-900">
          Оплата от водителей — ждёт подтверждения
          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-bold">
            {orders.length}
          </span>
        </h2>
      </div>

      {orders.map((o) => {
        const commission = (o.cubes || 0) * 1000;
        return (
          <div
            key={o.id}
            className="bg-white rounded-2xl p-4 border border-green-200 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-neutral-900">
                {o.order_number || "Заказ"} · {o.driver_name || "Водитель"}
              </div>
              <div className="text-sm font-black text-green-600">
                {commission.toLocaleString("ru-RU")} ₸
              </div>
            </div>
            <div className="text-xs text-neutral-500">
              {o.cubes || 0} куб × 1 000 ₸ · клиент: {o.phone}
            </div>
            <button
              onClick={() => approve(o.id)}
              disabled={busy === o.id}
              className="w-full text-xs font-bold py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              {busy === o.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <BadgeCheck className="w-4 h-4" />
                  Подтвердить оплату и завершить заказ
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
