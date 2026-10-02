import React, { useState } from "react";
import { Hourglass, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/api/base44Client";
import { t } from "@/lib/i18n";

// Миксерист не может сам отменить заказ — только попросить диспетчера.
// Диспетчер видит запрос на Главной и решает: отменить без последствий
// (уважительная причина) или отменить с предупреждением.
export default function DriverCancelRequest({ order, onChanged }) {
  const [busy, setBusy] = useState(false);

  if (order.cancel_requested_at) {
    return (
      <div className="w-full text-xs font-bold py-2.5 px-3 rounded-lg bg-neutral-100 text-neutral-600 inline-flex items-center justify-center gap-1.5 text-center">
        <Hourglass className="w-4 h-4 shrink-0" />
        {t("Запрос на отмену отправлен — ждём решения диспетчера")}
      </div>
    );
  }

  const request = async (e) => {
    e?.stopPropagation?.();
    const reason = prompt(
      t("Почему нужно отменить заказ? Диспетчер проверит причину. Если она неуважительная, заказ всё равно отменят, но вы получите предупреждение (3 предупреждения — чёрный список).")
    );
    if (reason == null) return;
    if (reason.trim().length < 3) {
      alert(t("Опишите причину хотя бы парой слов."));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          cancel_requested_at: new Date().toISOString(),
          cancel_request_reason: reason.trim(),
        })
        .eq("id", order.id);
      if (error) throw error;
      onChanged?.();
    } catch (err) {
      console.error(err);
      alert(t("Не удалось отправить запрос. Попробуйте ещё раз."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={request}
      disabled={busy}
      className="w-full text-xs font-bold py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
      {t("Попросить диспетчера отменить заказ")}
    </button>
  );
}
