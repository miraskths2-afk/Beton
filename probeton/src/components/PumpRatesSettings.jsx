import React, { useEffect, useState } from "react";
import { Loader2, Save, Construction } from "lucide-react";
import { fetchSettings, updateSettings } from "@/lib/balance";
import { PUMP_BOOMS, PUMP_MIN_HOURS, pumpErrorText } from "@/lib/pump";
import { t } from "@/lib/i18n";

// Цены АБН за час по длине стрелы. Меняет только админ (страница
// «Партнёры» → «АБН»). 0 — цена «уточняется»: клиент видит заявку без
// суммы, насосник договаривается в чате.
export default function PumpRatesSettings() {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        const r = s?.pump_rates || {};
        setRates(Object.fromEntries(PUMP_BOOMS.map((b) => [b, r[String(b)] ? String(r[String(b)]) : ""])));
      })
      .catch((e) => setError(pumpErrorText(e)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateSettings({
        pump_rates: Object.fromEntries(
          PUMP_BOOMS.map((b) => [String(b), Math.max(0, Number(rates[b]) || 0)])
        ),
      });
      setSaved(true);
    } catch (e) {
      console.error(e);
      setError(pumpErrorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Construction className="w-4 h-4 text-sky-600" />
        <span className="font-bold text-neutral-900 text-sm">{t("Цены АБН за час")}</span>
      </div>
      <p className="text-xs text-neutral-500 -mt-1">
        {t("Клиент оплачивает сразу минимум {n} часа. Оставьте 0 — цена «уточняется», договариваются в чате.", { n: PUMP_MIN_HOURS })}
      </p>
      {loading ? (
        <div className="text-center py-4 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {PUMP_BOOMS.map((b) => (
            <label key={b} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
              <span className="text-sm font-bold text-neutral-800 w-12 shrink-0">{b} м</span>
              <input
                type="number"
                min="0"
                step="1000"
                inputMode="numeric"
                value={rates[b] ?? ""}
                onChange={(e) => {
                  setSaved(false);
                  setRates((p) => ({ ...p, [b]: e.target.value }));
                }}
                placeholder="0"
                className="w-full min-w-0 text-sm text-right focus:outline-none"
              />
              <span className="text-xs text-neutral-400 shrink-0">₸/ч</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}
      <button
        onClick={save}
        disabled={saving || loading}
        className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? t("Сохранено") : t("Сохранить цены")}
      </button>
    </div>
  );
}
