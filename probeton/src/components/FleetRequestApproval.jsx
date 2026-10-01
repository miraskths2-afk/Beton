import React, { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { Check, X, Factory, Phone } from "lucide-react";
import { t } from "@/lib/i18n";
import { driverName, plantName, plantsErrorText } from "@/lib/plants";

// Запросы заводов на добавление миксеристов в парк — их одобряет админ.
export default function FleetRequestApproval() {
  const [items, setItems] = useState([]);
  const [plants, setPlants] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    // Если supabase_plants.sql ещё не выполнен — колонки нет, просто молчим.
    const { data, error: err } = await supabase
      .from("app_users")
      .select("*")
      .not("plant_request_id", "is", null);
    if (err) return;
    setItems(data || []);
    const ids = [...new Set((data || []).map((d) => d.plant_request_id))];
    if (ids.length) {
      const { data: ps } = await supabase
        .from("app_users")
        .select("id, full_name, phone")
        .in("id", ids);
      setPlants(Object.fromEntries((ps || []).map((p) => [p.id, p])));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (d, approve) => {
    setBusy(d.id);
    setError("");
    try {
      const { error: err } = await supabase
        .from("app_users")
        .update(
          approve
            ? { plant_id: d.plant_request_id, plant_request_id: null }
            : { plant_request_id: null }
        )
        .eq("id", d.id);
      if (err) throw err;
      setItems((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      console.error(e);
      setError(t(plantsErrorText(e)));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Factory className="w-4 h-4 text-purple-600" />
        <h2 className="text-sm font-black text-neutral-900">
          {t("Заводы просят добавить в парк")}
          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">
            {items.length}
          </span>
        </h2>
      </div>
      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}
      {items.map((d) => (
        <div key={d.id} className="bg-white rounded-2xl p-4 border border-purple-200 shadow-sm space-y-2">
          <div className="font-bold text-neutral-900">{driverName(d)}</div>
          <div className="text-xs text-neutral-600 flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Factory className="w-3 h-3" />
              {t("Завод: {name}", { name: plantName(plants[d.plant_request_id]) })}
            </span>
            {d.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {d.phone}
              </span>
            )}
            {d.vehicle_plate && <span>{d.vehicle_plate}</span>}
            {d.plant_id && (
              <span className="font-semibold text-amber-600">
                {t("Сейчас в парке другого завода")}
              </span>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => decide(d, true)}
              disabled={busy === d.id}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {t("Одобрить")}
            </button>
            <button
              onClick={() => decide(d, false)}
              disabled={busy === d.id}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              {t("Отклонить")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
