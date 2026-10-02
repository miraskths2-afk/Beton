import React, { useEffect, useState } from "react";
import { base44, supabase } from "@/api/base44Client";
import { Flag, Loader2 } from "lucide-react";
import { t, locale } from "@/lib/i18n";

// Жалобы миксеристов («клиент не оплатил»). Раньше жалоба сразу заносила
// клиента в чёрный список — теперь решает админ.
export default function ComplaintsReview() {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState({});
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .eq("status", "open")
        .order("created_date", { ascending: false });
      if (error) throw error;
      setItems(data || []);
      const ids = [...new Set((data || []).map((c) => c.order_id).filter(Boolean))];
      if (ids.length) {
        const { data: os } = await supabase
          .from("orders")
          .select("id, order_number, cubes, client_paid, commission_paid")
          .in("id", ids);
        setOrders(Object.fromEntries((os || []).map((o) => [o.id, o])));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`complaints:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const resolve = async (c, accept) => {
    const text = accept
      ? t("Внести номер {phone} в чёрный список?", { phone: c.against_phone })
      : t("Отклонить жалобу?");
    if (!confirm(text)) return;
    setBusy(c.id);
    try {
      if (accept) {
        await base44.entities.Blacklist.create({
          phone: c.against_phone,
          reason: c.reason || "Жалоба миксериста",
        });
      }
      const { error } = await supabase
        .from("complaints")
        .update({
          status: accept ? "accepted" : "rejected",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", c.id);
      if (error) throw error;
      setItems((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e) {
      console.error(e);
      alert(t("Не удалось сохранить решение. Попробуйте ещё раз."));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Flag className="w-4 h-4 text-red-600" />
        <h2 className="text-sm font-black text-neutral-900">
          {t("Жалобы миксеристов")}
          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">
            {items.length}
          </span>
        </h2>
      </div>

      {items.map((c) => {
        const o = orders[c.order_id];
        return (
          <div
            key={c.id}
            className="bg-white rounded-2xl p-4 border border-red-200 shadow-sm space-y-2"
          >
            <div className="font-bold text-neutral-900">
              {c.reason || t("Жалоба")} · {o?.order_number || t("Заказ")}
            </div>
            <div className="text-xs text-neutral-500">
              {t("От: {name} · клиент: {phone}", { name: c.from_name || "—", phone: c.against_phone })}
            </div>
            <div className="text-xs text-neutral-500">
              {new Date(c.created_date).toLocaleString(locale())}
              {o && (o.client_paid || o.commission_paid)
                ? ` · ${t("клиент отметил оплату")}`
                : ""}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => resolve(c, false)}
                disabled={busy === c.id}
                className="text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-50"
              >
                {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Отклонить")}
              </button>
              <button
                onClick={() => resolve(c, true)}
                disabled={busy === c.id}
                className="text-xs font-bold py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("В чёрный список")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
