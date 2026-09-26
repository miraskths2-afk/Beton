import React, { useState, useEffect } from "react";
import { base44, supabase } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Truck, MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { distanceKm, formatKm } from "@/lib/geo";
import { t } from "@/lib/i18n";

export default function TransferToPlantDialog({
  order,
  open,
  onOpenChange,
  onTransferred,
}) {
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setLoadingDrivers(true);
    (async () => {
      try {
        const { data: online } = await supabase
          .from("driver_locations")
          .select("driver_id, lat, lng")
          .eq("is_online", true);
        const ids = (online || []).map((r) => r.driver_id);
        if (ids.length === 0) {
          setDrivers([]);
          return;
        }
        const [all, activeOrders] = await Promise.all([
          base44.entities.User.list(),
          base44.entities.Order.list("-created_date", 500),
        ]);
        // Водитель, у которого уже есть незавершённый заказ, занят —
        // нельзя выдать ему ещё один поверх текущего.
        const busyIds = new Set(
          activeOrders
            .filter((o) => o.driver_id && o.status !== "done" && o.status !== "cancelled")
            .map((o) => o.driver_id)
        );
        // Умный подбор: считаем расстояние от водителя до объекта и
        // ставим ближайших свободных наверх (как подбор курьера в
        // Bolt/Wolt). Занятые — всегда в конце списка.
        const locById = Object.fromEntries((online || []).map((r) => [r.driver_id, r]));
        const hasTarget = order?.delivery_lat != null && order?.delivery_lng != null;
        const list = all
          .filter((u) => ids.includes(u.id))
          .map((u) => {
            const loc = locById[u.id];
            const km = hasTarget && loc
              ? distanceKm(loc.lat, loc.lng, order.delivery_lat, order.delivery_lng)
              : null;
            return { ...u, isBusy: busyIds.has(u.id), distanceKm: km };
          })
          .sort((a, b) => {
            if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
            if (a.distanceKm == null && b.distanceKm == null) return 0;
            if (a.distanceKm == null) return 1;
            if (b.distanceKm == null) return -1;
            return a.distanceKm - b.distanceKm;
          });
        setDrivers(list);
        // Ближайший свободный выбирается сразу — диспетчеру остаётся
        // только нажать "Назначить".
        const nearest = list.find((d) => !d.isBusy);
        if (nearest && hasTarget) setSelectedId(nearest.id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDrivers(false);
      }
    })();
    // order меняется только вместе с open — отдельно следить не нужно
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    const driver = drivers.find((d) => d.id === selectedId);
    if (!driver || driver.isBusy) return;
    setLoading(true);
    try {
      await base44.entities.Order.update(order.id, {
        driver_id: driver.id,
        driver_name: driver.full_name || driver.driver_name || driver.phone || "Водитель",
        status: "in_progress",
        accepted_at: new Date().toISOString(),
      });
      onTransferred?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Назначить миксер на заказ")}</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {loadingDrivers ? (
            <div className="text-center py-8 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {t("Сейчас никто не на линии.")}
              <br />
              {t("Попробуйте позже, когда появятся свободные миксеристы.")}
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {order?.delivery_lat == null && (
                <p className="text-xs text-neutral-400 px-1">
                  {t("У заказа нет точки на карте — расстояние посчитать нельзя.")}
                </p>
              )}
              {drivers.map((d, index) => (
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
                    <div className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                      {d.full_name || d.driver_name || d.phone}
                      {!d.isBusy && index === 0 && d.distanceKm != null && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          {t("Ближайший")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {d.isBusy ? t("Занят другим заказом") : d.vehicle_plate || t("На линии")}
                    </div>
                  </div>
                  {d.distanceKm != null && (
                    <div className="ml-auto mr-2 shrink-0 text-xs font-bold text-neutral-700 flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      {formatKm(d.distanceKm)}
                    </div>
                  )}
                  {!d.isBusy && selectedId === d.id && (
                    <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Отмена")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedId}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {t("Назначить миксер")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
