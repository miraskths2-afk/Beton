import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Flame, Loader2 } from "lucide-react";
import { resolveLeftoverClose } from "@/lib/kubovik";
import { t, locale } from "@/lib/i18n";

// Запросы на завершение сделок Кубовика. Ни миксерист, ни заказчик не
// могут закрыть сделку сами — только админ, вот здесь.
export default function LeftoverCloseRequests() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const all = await base44.entities.Leftover.list("-created_date", 200);
      setItems(all.filter((l) => l.close_requested_at && l.status === "intercepted"));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Leftover.subscribe(() => load());
    return unsub;
  }, []);

  const resolve = async (l, complete) => {
    const text = complete
      ? t("Завершить эту сделку Кубовика?")
      : t("Отклонить запрос? Сделка останется открытой.");
    if (!confirm(text)) return;
    setBusy(l.id);
    try {
      await resolveLeftoverClose(l.id, complete);
      setItems((prev) => prev.filter((x) => x.id !== l.id));
    } catch (e) {
      console.error(e);
      alert(t("Не удалось сохранить. Попробуйте ещё раз."));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Flame className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-black text-neutral-900">
          {t("Кубовик: просят завершить сделку")}
          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold">
            {items.length}
          </span>
        </h2>
      </div>

      {items.map((l) => (
        <div
          key={l.id}
          className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm space-y-2"
        >
          <Link to={`/leftover/${l.id}`} className="block font-bold text-neutral-900 underline-offset-2 hover:underline">
            {l.grade ? `${l.grade} · ` : ""}
            {t("{cubes} куб", { cubes: l.cubes })} ·{" "}
            {Number(l.price || 0).toLocaleString(locale())} ₸
          </Link>
          <div className="text-xs text-neutral-500">
            {t("Миксерист:")} {l.driver_name || "—"} {l.phone ? `· ${l.phone}` : ""}
            <br />
            {t("Заказчик:")} {l.intercepted_by_phone || "—"}
          </div>
          <div className="text-sm text-neutral-800 bg-neutral-50 rounded-lg px-3 py-2">
            <span className="font-semibold">
              {l.close_requested_by === "client" ? t("Пишет заказчик:") : t("Пишет миксерист:")}
            </span>{" "}
            {l.close_request_note || t("просит завершить сделку")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => resolve(l, false)}
              disabled={busy === l.id}
              className="text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-50"
            >
              {t("Отклонить")}
            </button>
            <button
              onClick={() => resolve(l, true)}
              disabled={busy === l.id}
              className="text-xs font-bold py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy === l.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Завершить")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
