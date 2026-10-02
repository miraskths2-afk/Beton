import React, { useEffect, useState } from "react";
import { base44, supabase } from "@/api/base44Client";
import { XCircle, Loader2 } from "lucide-react";
import { addWarning, WARN_LIMIT } from "@/lib/warnings";
import { t } from "@/lib/i18n";

// Запросы миксеристов на отмену заказа. Админ в любом случае отменяет
// заказ, но решает, уважительная ли причина: если нет — миксерист
// получает предупреждение (3 предупреждения — чёрный список).
export default function CancelRequestsApproval() {
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      setOrders(
        all.filter(
          (o) =>
            o.cancel_requested_at &&
            o.status !== "done" &&
            o.status !== "cancelled"
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
  }, []);

  const resolve = async (o, withWarning) => {
    const text = withWarning
      ? t("Отменить заказ и выдать миксеристу предупреждение?")
      : t("Отменить заказ без предупреждения (причина уважительная)?");
    if (!confirm(text)) return;
    setBusy(o.id);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          cancelled_by: withWarning ? "driver" : "driver_excused",
        })
        .eq("id", o.id);
      if (error) throw error;
      if (withWarning && o.driver_id) {
        const count = await addWarning(o.driver_id, "отмена заказа миксеристом");
        alert(
          count >= WARN_LIMIT
            ? t("Заказ отменён. У миксериста {n} предупреждения — он в чёрном списке.", { n: count })
            : t("Заказ отменён. Миксеристу выдано предупреждение {n} из {limit}.", { n: count, limit: WARN_LIMIT })
        );
      }
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } catch (e) {
      console.error(e);
      alert(t("Не удалось отменить заказ. Попробуйте ещё раз."));
    } finally {
      setBusy(null);
    }
  };

  if (orders.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <XCircle className="w-4 h-4 text-red-600" />
        <h2 className="text-sm font-black text-neutral-900">
          {t("Миксеристы просят отменить заказ")}
          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">
            {orders.length}
          </span>
        </h2>
      </div>

      {orders.map((o) => (
        <div
          key={o.id}
          className="bg-white rounded-2xl p-4 border border-red-200 shadow-sm space-y-2"
        >
          <div className="font-bold text-neutral-900">
            {o.order_number || t("Заказ")} · {o.driver_name || t("Миксерист")}
          </div>
          <div className="text-xs text-neutral-500">{o.what_needed}</div>
          <div className="text-sm text-neutral-800 bg-neutral-50 rounded-lg px-3 py-2">
            <span className="font-semibold">{t("Причина:")}</span> {o.cancel_request_reason}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => resolve(o, false)}
              disabled={busy === o.id}
              className="text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-50"
            >
              {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Причина уважительная")}
            </button>
            <button
              onClick={() => resolve(o, true)}
              disabled={busy === o.id}
              className="text-xs font-bold py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t("Отменить с предупреждением")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
