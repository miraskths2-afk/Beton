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
import { Loader2, Send, Truck, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { fetchFleet, fetchDriverState, driverName, plantsErrorText } from "@/lib/plants";
import {
  assignOrderMixers,
  orderDetailsErrorText,
  trucksEstimate,
  trucksText,
} from "@/lib/orderExtras";
import { isPumpOrder, pumpTitle } from "@/lib/pump";

// Делим кубы поровну между машинами (шаг 0.5 м³), остаток — последней.
function splitCubes(total, n) {
  if (n <= 0) return [];
  const per = Math.floor((total / n) * 2) / 2;
  const parts = Array(n).fill(per);
  parts[n - 1] = Math.round((total - per * (n - 1)) * 100) / 100;
  return parts;
}

// Завод выделяет миксериста из своего парка на заявку.
// Если миксер на заявку ещё не выделен, можно выбрать несколько машин
// и разделить кубы между ними — каждая машина станет отдельным рейсом
// (функция assign_order_mixers в supabase_order_details.sql).
// Карты с водителями здесь нет намеренно: завод не видит миксеристов
// на карте — только список: на линии / занят.
// На заявку АБН завод выделяет насосника из парка (одного), на бетон —
// миксеристов.
export default function AssignFleetDriverDialog({ plantId, order, open, onOpenChange, onAssigned }) {
  const pump = isPumpOrder(order);
  const [drivers, setDrivers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  // Режим нескольких машин: выбранные по порядку и их кубы.
  const [selectedIds, setSelectedIds] = useState([]);
  const [cubesBy, setCubesBy] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !plantId) return;
    setSelectedId(null);
    setSelectedIds([]);
    setCubesBy({});
    setError("");
    setLoadingList(true);
    (async () => {
      try {
        const fleet = (await fetchFleet(plantId)).filter(
          (d) =>
            d.approval_status === "approved" &&
            (pump ? d.account_type === "pump" : d.account_type !== "pump")
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

  const totalCubes = Number(order?.cubes) || 0;
  const multi =
    !pump && !!order && (order.status || "new") === "new" && !order.driver_id && totalCubes > 0;
  const estimate = trucksEstimate(totalCubes);
  const sumCubes = selectedIds.reduce((acc, id) => acc + (Number(cubesBy[id]) || 0), 0);
  const sumOk = selectedIds.length > 0 && Math.abs(sumCubes - totalCubes) < 0.01 &&
    selectedIds.every((id) => Number(cubesBy[id]) > 0);

  const toggleMulti = (id) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    const parts = splitCubes(totalCubes, next.length);
    setCubesBy(Object.fromEntries(next.map((x, i) => [x, String(parts[i])])));
  };

  const submitMulti = async () => {
    if (!sumOk) return;
    if (selectedIds.length === 1) {
      return submit(selectedIds[0]);
    }
    setSaving(true);
    setError("");
    try {
      await assignOrderMixers(
        plantId,
        order.id,
        selectedIds.map((id) => ({ driver_id: id, cubes: Number(cubesBy[id]) }))
      );
      onAssigned?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError(t(orderDetailsErrorText(e)));
    } finally {
      setSaving(false);
    }
  };

  const submit = async (forcedId) => {
    const d = drivers.find((x) => x.id === (forcedId || selectedId));
    if (!d || d.isBusy) return;
    setSaving(true);
    setError("");
    try {
      const fields = {
        driver_id: d.id,
        driver_name: driverName(d),
      };
      // Свой насос нашёлся — найм на сайте больше не нужен.
      if (pump) fields.pump_hire_open = false;
      // Сменили исполнителя до конца работы — его таймер начнётся заново,
      // а не от времени приезда прежнего.
      if (order.driver_id && order.driver_id !== d.id && !order.unloaded_at) {
        fields.arrived_at = null;
        fields.downtime_hours = 0;
        fields.downtime_fee = 0;
      }
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
          <DialogTitle>{pump ? t("Выделить насосника из парка") : t("Выделить миксериста из парка")}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {multi && totalCubes > 0 && (
            <div className="mb-2 text-xs text-neutral-600 bg-neutral-100 rounded-lg px-3 py-2">
              {t("Заявка на {cubes} м³ — понадобится примерно {trucks}. Отметьте одного или несколько миксеристов, кубы разделятся между ними.", {
                cubes: totalCubes,
                trucks: trucksText(estimate),
              })}
            </div>
          )}
          {loadingList ? (
            <div className="text-center py-8 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {pump
                ? t("В парке нет одобренных насосников. Добавьте их на вкладке «Парк» или наймите насосника на сайте.")
                : t("В парке нет одобренных миксеристов. Добавьте их на вкладке «Парк».")}
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {drivers.map((d) => (
                <button
                  key={d.id}
                  onClick={() => !d.isBusy && (multi ? toggleMulti(d.id) : setSelectedId(d.id))}
                  disabled={d.isBusy}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-colors flex items-center justify-between",
                    d.isBusy
                      ? "border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed"
                      : (multi ? selectedIds.includes(d.id) : selectedId === d.id)
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
                      {d.pump_boom ? `${pumpTitle(d.pump_boom)} · ` : ""}
                      {d.isBusy
                        ? t("Занят другим заказом")
                        : d.online
                        ? t("На линии")
                        : t("Не на линии")}
                    </div>
                  </div>
                  {!d.isBusy && multi && selectedIds.includes(d.id) && (
                    <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  {!d.isBusy && !multi && selectedId === d.id && (
                    <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {multi && selectedIds.length > 1 && (
            <div className="mt-3 space-y-2 rounded-xl border border-neutral-200 p-3">
              <div className="text-xs font-bold text-neutral-600">
                {t("Сколько кубов везёт каждая машина")}
              </div>
              {selectedIds.map((id, i) => {
                const d = drivers.find((x) => x.id === id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm truncate">
                      {i + 1}. {driverName(d)}
                    </span>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={cubesBy[id] ?? ""}
                      onChange={(e) => setCubesBy((p) => ({ ...p, [id]: e.target.value }))}
                      className="h-9 w-20"
                    />
                    <span className="text-xs text-neutral-500">м³</span>
                  </div>
                );
              })}
              <div
                className={cn(
                  "text-xs font-bold",
                  sumOk ? "text-green-600" : "text-red-600"
                )}
              >
                {t("Итого {sum} из {total} м³", {
                  sum: Math.round(sumCubes * 100) / 100,
                  total: totalCubes,
                })}
              </div>
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
            onClick={() => (multi ? submitMulti() : submit())}
            disabled={
              saving ||
              (multi ? !sumOk : !selectedId || selectedId === order?.driver_id)
            }
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {multi && selectedIds.length > 1
              ? t("Назначить миксеров: {n}", { n: selectedIds.length })
              : pump
              ? t("Назначить насос")
              : t("Назначить миксер")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
