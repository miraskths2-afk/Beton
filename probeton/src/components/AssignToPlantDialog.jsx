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
import { Loader2, Send, Factory, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { distanceKm, formatKm } from "@/lib/geo";
import { t } from "@/lib/i18n";
import { fetchPlants, fetchDriverState, plantName, plantsErrorText } from "@/lib/plants";
import { isPumpOrder, attachPumpOrdersToPlant } from "@/lib/pump";

// Админ передаёт заявку клиента заводу. Дальше завод сам выделяет
// миксериста из своего парка. Ближайшие работающие заводы — наверху.
export default function AssignToPlantDialog({ order, open, onOpenChange, onAssigned }) {
  const [plants, setPlants] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setError("");
    setLoadingList(true);
    (async () => {
      try {
        const all = await fetchPlants();
        const plantIds = all.map((p) => p.id);
        let fleet = [];
        if (plantIds.length) {
          const { data, error: fleetErr } = await supabase
            .from("app_users")
            .select("id, plant_id")
            .in("plant_id", plantIds);
          if (fleetErr) throw fleetErr;
          fleet = data || [];
        }
        const st = await fetchDriverState(fleet.map((d) => d.id));
        const hasTarget = order?.delivery_lat != null && order?.delivery_lng != null;
        const list = all
          .map((p) => {
            const drivers = fleet.filter((d) => d.plant_id === p.id);
            return {
              ...p,
              fleetSize: drivers.length,
              freeOnline: drivers.filter((d) => st.online.has(d.id) && !st.busy.has(d.id)).length,
              distanceKm:
                hasTarget && p.plant_lat != null && p.plant_lng != null
                  ? distanceKm(p.plant_lat, p.plant_lng, order.delivery_lat, order.delivery_lng)
                  : null,
            };
          })
          .sort((a, b) => {
            if (a.plant_active !== b.plant_active) return a.plant_active ? -1 : 1;
            if (a.distanceKm == null && b.distanceKm == null) return 0;
            if (a.distanceKm == null) return 1;
            if (b.distanceKm == null) return -1;
            return a.distanceKm - b.distanceKm;
          });
        setPlants(list);
        const first = list.find((p) => p.plant_active);
        if (first) setSelectedId(first.id);
      } catch (e) {
        console.error(e);
        setError(t(plantsErrorText(e)));
      } finally {
        setLoadingList(false);
      }
    })();
  }, [open]);

  const submit = async () => {
    const p = plants.find((x) => x.id === selectedId);
    if (!p) return;
    if (order.driver_id && !confirm(t("У заявки уже есть миксерист. Снять его и передать заявку заводу?"))) return;
    setSaving(true);
    setError("");
    try {
      // Статус остаётся «Поиск машины», пока завод не выделит миксер.
      const { error: upErr } = await supabase
        .from("orders")
        .update({
          plant_id: p.id,
          plant_name: plantName(p),
          driver_id: null,
          driver_name: null,
          accepted_at: null,
          status: "new",
        })
        .eq("id", order.id);
      if (upErr) throw upErr;
      // АБН, заказанный к этой заявке бетона, тоже переходит к заводу.
      if (!isPumpOrder(order)) await attachPumpOrdersToPlant(order.id, { id: p.id, name: plantName(p) });
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
          <DialogTitle>{t("Передать заявку заводу")}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {loadingList ? (
            <div className="text-center py-8 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : plants.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">
              <Factory className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {t("Заводов пока нет. Добавьте их на странице «Заводы».")}
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {plants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-colors flex items-center justify-between gap-2",
                    selectedId === p.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200",
                    !p.plant_active && "opacity-60"
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-neutral-900 truncate">
                      {plantName(p)}
                      {order?.plant_id === p.id && (
                        <span className="ml-2 text-[10px] font-bold text-neutral-400">{t("сейчас у этого завода")}</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {p.plant_active ? "" : `${t("Не работает")} · `}
                      {t("Парк: {n} · свободны на линии: {free}", { n: p.fleetSize, free: p.freeOnline })}
                    </div>
                  </div>
                  {p.distanceKm != null && (
                    <div className="ml-auto shrink-0 text-xs font-bold text-neutral-700 flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      {formatKm(p.distanceKm)}
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
            disabled={saving || !selectedId || selectedId === order?.plant_id}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {t("Передать заводу")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
