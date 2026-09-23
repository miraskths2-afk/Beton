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
import { Loader2, Send, Truck, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

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
          .select("driver_id")
          .eq("is_online", true);
        const ids = (online || []).map((r) => r.driver_id);
        if (ids.length === 0) {
          setDrivers([]);
          return;
        }
        const all = await base44.entities.User.list();
        setDrivers(all.filter((u) => ids.includes(u.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDrivers(false);
      }
    })();
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    const driver = drivers.find((d) => d.id === selectedId);
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
          <DialogTitle>Назначить миксер на заказ</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {loadingDrivers ? (
            <div className="text-center py-8 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Сейчас никто не на линии.
              <br />
              Попробуйте позже, когда появятся свободные миксеристы.
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {drivers.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-colors flex items-center justify-between",
                    selectedId === d.id
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200"
                  )}
                >
                  <div>
                    <div className="font-bold text-sm text-neutral-900">
                      {d.full_name || d.driver_name || d.phone}
                    </div>
                    <div className="text-xs text-neutral-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {d.vehicle_plate || "На линии"}
                    </div>
                  </div>
                  {selectedId === d.id && (
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
            Отмена
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
            Назначить миксер
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
