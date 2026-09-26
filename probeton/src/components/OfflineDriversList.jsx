import React, { useEffect, useState } from "react";
import { base44, supabase } from "@/api/base44Client";
import { Phone, Trash2, Loader2, UserX } from "lucide-react";
import { t } from "@/lib/i18n";

export default function OfflineDriversList() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const [allDrivers, onlineRows] = await Promise.all([
        base44.entities.User.list(),
        supabase.from("driver_locations").select("driver_id").eq("is_online", true),
      ]);
      const onlineIds = new Set((onlineRows.data || []).map((r) => r.driver_id));
      const offline = allDrivers.filter(
        (u) => u.account_type === "driver" && !onlineIds.has(u.id)
      );
      setDrivers(offline);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub1 = base44.entities.User.subscribe(() => load());
    // Также обновляем список, когда кто-то выходит/заходит на линию.
    const channel = supabase
      .channel(`realtime:driver_locations_offline:${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        () => load()
      )
      .subscribe();
    return () => {
      unsub1();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteDriver = async (id, name) => {
    if (
      !confirm(
        name
          ? t("Удалить аккаунт водителя «{name}» безвозвратно? Это действие нельзя отменить.", { name })
          : t("Удалить аккаунт водителя безвозвратно? Это действие нельзя отменить.")
      )
    )
      return;
    setBusyId(id);
    try {
      await supabase.from("driver_locations").delete().eq("driver_id", id);
      await base44.entities.User.delete(id);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-6 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
        {t("Все водители сейчас на линии")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drivers.map((d) => (
        <div
          key={d.id}
          className="bg-white rounded-xl p-3 border border-neutral-200 flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <div className="font-bold text-sm text-neutral-900 truncate flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              {d.full_name || d.driver_name || d.phone}
            </div>
            <div className="text-xs text-neutral-500">
              {d.vehicle_plate || "—"} ·{" "}
              {d.approval_status === "approved" ? t("Одобрен") : t("На одобрении")}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {d.phone && (
              <a
                href={`tel:${d.phone}`}
                className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                title={t("Позвонить")}
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => deleteDriver(d.id, d.full_name || d.driver_name)}
              disabled={busyId === d.id}
              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
              title={t("Удалить аккаунт")}
            >
              {busyId === d.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
