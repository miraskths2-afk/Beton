import React, { useEffect, useState } from "react";
import { base44, supabase } from "@/api/base44Client";
import { BadgeCheck, Loader2, Truck, Factory } from "lucide-react";
import { t, locale } from "@/lib/i18n";
import { fetchSettings } from "@/lib/balance";
import { isPumpOrder, pumpBilledHours, pumpServiceFee, pumpTitle } from "@/lib/pump";

// Сбор с одной строки заказа: бетон — куб × 1 000 ₸, АБН — часы × сбор за час.
const rowFee = (o, settings) =>
  isPumpOrder(o) ? pumpServiceFee(o, settings) : (o.cubes || 0) * 1000;

// Заявки завода закрываются целиком: бетон, его рейсы и АБН к нему.
const groupKey = (o) =>
  o.plant_id ? `plant:${o.pump_for_order_id || o.parent_order_id || o.id}` : o.id;

export default function DriverPaymentApproval() {
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      setOrders(
        all.filter(
          (o) =>
            o.driver_paid &&
            !o.driver_payment_confirmed &&
            o.status !== "done" &&
            o.status !== "cancelled"
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
    fetchSettings().then(setSettings).catch(console.error);
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
  }, []);

  // Подтверждаем оплату сбора и одновременно завершаем заказ (для завода —
  // все строки заявки сразу): оплата — условие закрытия заказа.
  const approve = async (key, rows) => {
    setBusy(key);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          driver_payment_confirmed: true,
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .in(
          "id",
          rows.map((o) => o.id)
        );
      if (error) throw error;
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
      load();
    }
  };

  if (loading) return null;
  if (orders.length === 0) return null;

  const groups = [];
  const byKey = new Map();
  for (const o of orders) {
    const key = groupKey(o);
    if (!byKey.has(key)) {
      byKey.set(key, []);
      groups.push(key);
    }
    byKey.get(key).push(o);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Truck className="w-4 h-4 text-green-600" />
        <h2 className="text-sm font-black text-neutral-900">
          {t("Оплата от водителей — ждёт подтверждения")}
          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-bold">
            {groups.length}
          </span>
        </h2>
      </div>

      {groups.map((key) => {
        const rows = byKey.get(key);
        const head = rows[0];
        const fromPlant = !!head.plant_id;
        const total = rows.reduce((s, o) => s + rowFee(o, settings), 0);
        return (
          <div
            key={key}
            className="bg-white rounded-2xl p-4 border border-green-200 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-neutral-900 min-w-0">
                {fromPlant ? (
                  <span className="inline-flex items-center gap-1">
                    <Factory className="w-4 h-4 text-purple-600 shrink-0" />
                    {t("Завод «{name}»", { name: head.plant_name || "" })}
                  </span>
                ) : (
                  <>
                    {head.order_number || t("Заказ")} · {head.driver_name || t("Водитель")}
                  </>
                )}
              </div>
              <div className="text-sm font-black text-green-600 shrink-0">
                {total.toLocaleString(locale())} ₸
              </div>
            </div>
            <div className="space-y-0.5">
              {rows.map((o) => (
                <div key={o.id} className="text-xs text-neutral-500">
                  {fromPlant && `${o.order_number || t("Заказ")} · ${o.driver_name || ""} · `}
                  {isPumpOrder(o)
                    ? t("{title}: {n} ч × {rate} ₸ = {fee} ₸", {
                        title: pumpTitle(o.pump_boom),
                        n: pumpBilledHours(o),
                        rate: Number(o.pump_fee_rate ?? rowFee(o, settings) / pumpBilledHours(o)).toLocaleString(locale()),
                        fee: rowFee(o, settings).toLocaleString(locale()),
                      })
                    : t("{cubes} куб × 1 000 ₸", { cubes: o.cubes || 0 })}
                </div>
              ))}
              <div className="text-xs text-neutral-500">{t("Клиент: {phone}", { phone: head.phone || "—" })}</div>
            </div>
            <button
              onClick={() => approve(key, rows)}
              disabled={busy === key}
              className="w-full text-xs font-bold py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              {busy === key ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <BadgeCheck className="w-4 h-4" />
                  {fromPlant && rows.length > 1
                    ? t("Подтвердить оплату и завершить всю заявку")
                    : t("Подтвердить оплату и завершить заказ")}
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
