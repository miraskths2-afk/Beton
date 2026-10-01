import React, { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { fetchFleet, fetchDriverState, driverName, plantsErrorText } from "@/lib/plants";

// Завод выделяет миксериста из своего парка на заявку.
// Карты с водителями здесь нет намеренно: завод не видит миксеристов
// на карте — только список: на линии / занят.
export default function AssignFleetDriverDialog({ plantId, order, open, onOpenChange, onAssigned }) {
  const [drivers, setDrivers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !plantId) return;
    setSelectedId(null);
    setError("");
    setLoadingList(true);
    (async () => {
      try {
        const fleet = (await fetchFleet(plantId)).filter(
          (d) => d.approval_status === "approved"
        );
        const st = await fetchDriverState(fleet.map((d) => d.id));
        const list = fleet
          .map((d) => ({
            ...d,
            online: st.online.has(d.id),
            // Свой же текущий водитель этой заявки — не "занят".
            isBusy: st.busy.has(d.id) && d.id !== order?.driver_id,
          }))
          .sort((a, b) => {
            if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
            if (a.online !== b.online) return a.online ? -1 : 1;
            return 0;
          });
        setDrivers(list);
      } catch (e) {
        console.error(e);
        setError(t(plantsErrorText(e)));
      } finally {
        setLoadingList(false);
      }
    })();
  }, [open, plantId]);

  const submit = async () => {
    const d = drivers.find((x) => x.id === selectedId);
    if (!d || d.isBusy) return;
    setSaving(true);
    setError("");
    try {
      const fields = {
        driver_id: d.id,
        driver_name: driverName(d),
      };
      if ((order.status || "new") === "new") {
        fields.status = "in_progress";
        fields.accepted_at = new Date().toISOString();
      }
      const { error: upErr } = await supabase
        .from("orders")
        .update(fields)
        .eq("id", order.id)
        .eq("plant_id", plantId);
      if (upErr) throw upErr;
      onAssigned?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError(t(plantsErrorText(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Выделить миксериста из парка")}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {loadingList ? (
            <div className="text-center py-8 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {t("В парке нет одобренных миксеристов. Добавьте их на вкладке «Парк».")}
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {drivers.map((d) => (
                <button
                  key={d.id}
                  onClick={() => !d.isBusy && setSelectedId(d.id)}
                  disabled={d.isBusy}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-colors flex items-center justify-between",
                    d.isBusy
                      ? "border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed"
                      : selectedId === d.id
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200"
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-neutral-900">
                      {driverName(d)}
                      {d.id === order?.driver_id && (
                        <span className="ml-2 text-[10px] font-bold text-neutral-400">{t("сейчас на заявке")}</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {d.vehicle_plate ? `${d.vehicle_plate} · ` : ""}
                      {d.isBusy
                        ? t("Занят другим заказом")
                        : d.online
                        ? t("На линии")
                        : t("Не на линии")}
                    </div>
                  </div>
                  {!d.isBusy && selectedId === d.id && (
                    <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="mt-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Отмена")}
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !selectedId || selectedId === order?.driver_id}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {t("Назначить миксер")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
