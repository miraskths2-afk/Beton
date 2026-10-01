import React, { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { BadgeCheck, Loader2, Wallet, X, Settings2 } from "lucide-react";
import { reviewTopup, fetchSettings, updateSettings, formatTenge } from "@/lib/balance";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";

// Админ: заявки водителей на пополнение баланса + цена публикации
// остатка в Кубовике и реквизиты Kaspi, которые видят водители.
export default function TopupApproval() {
  const { user } = useAuth();
  const [topups, setTopups] = useState([]);
  const [drivers, setDrivers] = useState({});
  const [busy, setBusy] = useState(null);
  const [settings, setSettings] = useState(null);
  const [fee, setFee] = useState("");
  const [kaspi, setKaspi] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("balance_topups")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setTopups(data || []);
      const ids = [...new Set((data || []).map((tp) => tp.user_id))];
      if (ids.length) {
        const { data: users } = await supabase
          .from("app_users")
          .select("id, phone, full_name, driver_name, balance")
          .in("id", ids);
        setDrivers(Object.fromEntries((users || []).map((u) => [u.id, u])));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setFee(String(s.leftover_post_fee ?? ""));
        setKaspi(s.kaspi_details || "");
      })
      .catch(console.error);
    const channel = supabase
      .channel(`topups:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "balance_topups" }, () =>
        load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const review = async (id, approve) => {
    if (!approve && !confirm(t("Отклонить заявку? Деньги не будут зачислены."))) return;
    setBusy(id);
    try {
      await reviewTopup(user?.id, id, approve);
      await load();
    } catch (e) {
      alert(e?.message || t("Не удалось обработать заявку"));
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const s = await updateSettings({
        leftover_post_fee: Math.max(0, Number(fee) || 0),
        kaspi_details: kaspi.trim(),
      });
      setSettings(s);
      setSettingsOpen(false);
    } catch (err) {
      alert(err?.message || t("Не удалось сохранить"));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-3">
      {topups.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Wallet className="w-4 h-4 text-orange-600" />
          <h2 className="text-sm font-black text-neutral-900">
            {t("Пополнения баланса водителей")}
            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold">
              {topups.length}
            </span>
          </h2>
        </div>
      )}

      {topups.map((tp) => {
        const d = drivers[tp.user_id];
        return (
          <div
            key={tp.id}
            className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-neutral-900">
                {d?.full_name || d?.driver_name || t("Водитель")}
              </div>
              <div className="text-sm font-black text-orange-600">{formatTenge(tp.amount)}</div>
            </div>
            <div className="text-xs text-neutral-500">
              {d?.phone || "—"} · {t("сейчас на балансе")} {formatTenge(d?.balance)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => review(tp.id, true)}
                disabled={busy === tp.id}
                className="flex-1 text-xs font-bold py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                {busy === tp.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4" />
                    {t("Деньги пришли, зачислить")}
                  </>
                )}
              </button>
              <button
                onClick={() => review(tp.id, false)}
                disabled={busy === tp.id}
                className="px-3 text-xs font-bold py-2.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 inline-flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                {t("Отклонить")}
              </button>
            </div>
          </div>
        );
      })}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <Settings2 className="w-4 h-4 text-neutral-500" />
            {t("Цена публикации остатка")}
          </span>
          <span className="text-sm font-black text-neutral-900">
            {settings ? formatTenge(settings.leftover_post_fee) : "…"}
          </span>
        </button>
        {settingsOpen && (
          <form onSubmit={saveSettings} className="px-4 pb-4 space-y-3 border-t border-neutral-100 pt-3">
            <label className="block text-xs font-semibold text-neutral-600">
              {t("Цена одной публикации, ₸ (0 — бесплатно)")}
              <input
                type="number"
                min="0"
                step="100"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-neutral-200 rounded-lg"
              />
            </label>
            <label className="block text-xs font-semibold text-neutral-600">
              {t("Реквизиты Kaspi для пополнения (видят водители)")}
              <input
                value={kaspi}
                onChange={(e) => setKaspi(e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-neutral-200 rounded-lg"
              />
            </label>
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full text-xs font-bold py-2.5 rounded-lg bg-neutral-900 text-white disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Сохранить")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
