import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, UserCheck, Loader2, Phone, Car } from "lucide-react";
import { t } from "@/lib/i18n";

const EQUIPMENT = {
  mixer: "Миксер (АБС)",
  pump_16: "АБН 16м",
  pump_24: "АБН 24м",
  pump_36: "АБН 36м",
  pump_52: "АБН 52м",
};

export default function DriverApproval() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const all = await base44.entities.User.list();
      setDrivers(all.filter((u) => u.role !== "admin"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id, status) => {
    setBusy(id);
    try {
      await base44.entities.User.update(id, { approval_status: status });
      setDrivers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, approval_status: status } : u))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const pending = drivers.filter((d) => d.approval_status === "pending");
  const approved = drivers.filter((d) => d.approval_status === "approved");

  if (loading) {
    return (
      <div className="text-center py-6 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  if (drivers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <UserCheck className="w-4 h-4 text-purple-600" />
        <h2 className="text-sm font-black text-neutral-900">
          {t("Заявки на одобрение")}
          {pending.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">
              {t("{n} новых", { n: pending.length })}
            </span>
          )}
        </h2>
      </div>

      {pending.map((d) => (
        <div
          key={d.id}
          className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-neutral-900">
              {d.full_name || d.driver_name || d.phone}
            </div>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">
              {t("На одобрении")}
            </span>
          </div>
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
            {d.account_type === "driver" ? t("Водитель") : t("Заказчик")}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            {d.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {d.phone}
              </span>
            )}
            {d.account_type === "driver" && d.vehicle_plate && (
              <span className="inline-flex items-center gap-1">
                <Car className="w-3 h-3" />
                {d.vehicle_plate}
              </span>
            )}
            {d.account_type === "driver" && d.equipment_type && (
              <span className="inline-flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                {EQUIPMENT[d.equipment_type] ? t(EQUIPMENT[d.equipment_type]) : d.equipment_type}
              </span>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStatus(d.id, "approved")}
              disabled={busy === d.id}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {t("Одобрить")}
            </button>
            <button
              onClick={() => setStatus(d.id, "rejected")}
              disabled={busy === d.id}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              {t("Отклонить")}
            </button>
          </div>
        </div>
      ))}

      {approved.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide px-1 pt-2">
            {t("Одобренные ({n})", { n: approved.length })}
          </div>
          {approved.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-xl p-3 border border-neutral-200 flex items-center justify-between"
            >
              <div className="text-sm font-semibold text-neutral-800">
                {d.full_name || d.driver_name || d.phone}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">
                  {d.account_type === "driver" ? d.vehicle_plate : t("Заказчик")}
                </span>
                <button
                  onClick={() => setStatus(d.id, "pending")}
                  disabled={busy === d.id}
                  className="text-xs text-neutral-400 hover:text-neutral-600 underline"
                >
                  {t("Отозвать")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
