import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "@/components/Skeleton";
import {
  Inbox,
  Phone,
  Package,
  Clock,
  CheckCircle2,
  Loader,
  Trash2,
  Droplets,
  Truck,
  Send,
  Ban,
  CheckSquare,
  Square,
  X,
  Download,
  Repeat,
} from "lucide-react";
import { t, locale } from "@/lib/i18n";
import { exportOrdersCsv } from "@/lib/orderExport";
import RecurringOrdersManager from "@/components/RecurringOrdersManager";
import TransferToPlantDialog from "@/components/TransferToPlantDialog";
import MixerIcon from "@/components/MixerIcon";

const STATUS = {
  new: { label: "Поиск машины", icon: Inbox, cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "В работе", icon: Loader, cls: "bg-amber-100 text-amber-700" },
  sent_to_plant: { label: "Назначен миксер", icon: MixerIcon, cls: "bg-purple-100 text-purple-700" },
  manufacturing: { label: "Бетон изготавливается", icon: Droplets, cls: "bg-orange-100 text-orange-700" },
  en_route: { label: "Машина в пути", icon: Truck, cls: "bg-green-100 text-green-700" },
  done: { label: "Готов", icon: CheckCircle2, cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Отменён клиентом", icon: Ban, cls: "bg-red-100 text-red-700" },
};

// Категории вкладки "Заявки". "Все" намеренно не включает завершённые —
// они показываются только в категории "Готово".
const CATEGORIES = [
  { id: "all", label: "Все", match: (s) => s !== "done" },
  { id: "new", label: "Новые", match: (s) => (s || "new") === "new" },
  {
    id: "searching",
    label: "В поиске",
    match: (s) => s === "sent_to_plant" || s === "manufacturing",
  },
  {
    id: "working",
    label: "В работе",
    match: (s) => s === "in_progress" || s === "en_route",
  },
  { id: "done", label: "Готово", match: (s) => s === "done" },
];

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [transferOrder, setTransferOrder] = useState(null);
  // Массовые действия: режим выбора и набор выбранных заявок.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);

  const load = async () => {
    try {
      const data = await base44.entities.Order.list("-created_date", 200);
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
  }, []);

  const updateStatus = async (id, status) => {
    try {
      const extra = {};
      if (status === "in_progress") extra.accepted_at = new Date().toISOString();
      if (status === "done") extra.completed_at = new Date().toISOString();
      await base44.entities.Order.update(id, { status, ...extra });
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status, ...extra } : o))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const remove = async (id) => {
    try {
      await base44.entities.Order.delete(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const blacklistPhone = async (o) => {
    if (!confirm(t("Внести номер {phone} в чёрный список?", { phone: o.phone }))) return;
    try {
      await base44.entities.Blacklist.create({
        phone: o.phone,
        reason: "Нарушение / неоплата",
      });
      alert(t("Номер добавлен в чёрный список."));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // Одна кнопка — одно обновление в базе для всех выбранных заявок.
  const bulkUpdate = async (status) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const label = status === "done" ? t("Готово") : t("Отменён");
    if (!confirm(t("Перевести выбранные заявки ({n}) в статус «{status}»?", { n: ids.length, status: label }))) {
      return;
    }
    setBulkBusy(true);
    try {
      const extra = {};
      if (status === "done") extra.completed_at = new Date().toISOString();
      const { error } = await supabase
        .from("orders")
        .update({ status, ...extra })
        .in("id", ids);
      if (error) throw error;
      setOrders((prev) =>
        prev.map((o) => (selected.has(o.id) ? { ...o, status, ...extra } : o))
      );
      exitSelectMode();
    } catch (err) {
      console.error(err);
      alert(t("Не удалось обновить заявки. Попробуйте ещё раз."));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(t("Удалить выбранные заявки ({n})? Это нельзя отменить.", { n: ids.length }))) {
      return;
    }
    setBulkBusy(true);
    try {
      const { error } = await supabase.from("orders").delete().in("id", ids);
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => !selected.has(o.id)));
      exitSelectMode();
    } catch (err) {
      console.error(err);
      alert(t("Не удалось удалить заявки. Попробуйте ещё раз."));
    } finally {
      setBulkBusy(false);
    }
  };

  // Выгрузка для бухгалтерии: берём до 5000 последних заявок (на экране
  // показываются только 200), фильтруем по текущей вкладке. Если что-то
  // выделено галочками — выгружаются только выделенные.
  const exportCsv = async () => {
    setExporting(true);
    try {
      let rows;
      if (selectMode && selected.size > 0) {
        rows = orders.filter((o) => selected.has(o.id));
      } else {
        const all = await base44.entities.Order.list("-created_date", 5000);
        rows = all.filter((o) => activeCategory.match(o.status || "new"));
      }
      exportOrdersCsv(rows, category === "all" ? "zakazy" : `zakazy-${category}`);
    } catch (err) {
      console.error(err);
      alert(t("Не удалось выгрузить данные."));
    } finally {
      setExporting(false);
    }
  };

  const activeCategory = CATEGORIES.find((c) => c.id === category);
  const filtered = orders.filter((o) => activeCategory.match(o.status || "new"));

  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, orders.filter((o) => c.match(o.status || "new")).length])
  );

  const fmtDate = (d) =>
    new Date(d).toLocaleString(locale(), {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="p-4 space-y-4">
      <div className="px-1 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-black text-neutral-900">{t("Заявки")}</h1>
          <p className="text-sm text-neutral-500">{t("Все входящие заказы")}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="h-9 px-3 rounded-lg border border-neutral-200 bg-white text-neutral-700 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
            title={t("Скачать таблицу для бухгалтерии")}
          >
            {exporting ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            CSV
          </button>
          <button
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className={cn(
              "h-9 px-3 rounded-lg border text-xs font-bold inline-flex items-center gap-1",
              selectMode
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-700 border-neutral-200"
            )}
          >
            {selectMode ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
            {selectMode ? t("Отмена") : t("Выбрать")}
          </button>
        </div>
      </div>

      <button
        onClick={() => setShowRecurring((v) => !v)}
        className="w-full flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900"
      >
        <span className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-neutral-500" />
          {t("Повторяющиеся заказы")}
        </span>
        <span className="text-xs text-neutral-400 font-semibold">
          {showRecurring ? t("Скрыть") : t("Открыть")}
        </span>
      </button>
      {showRecurring && <RecurringOrdersManager />}

      <div className="grid grid-cols-5 gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-xl py-2 px-0.5 text-center transition-all border",
              category === c.id
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200"
            )}
          >
            <div className="text-base font-black tabular-nums">{counts[c.id]}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide leading-tight">
              {t(c.label)}
            </div>
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("Заявок в этой категории нет")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {selectMode && (
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-neutral-500 font-semibold">
                {t("Выбрано: {n}", { n: selected.size })}
              </span>
              <button
                onClick={() =>
                  setSelected(
                    selected.size === filtered.length
                      ? new Set()
                      : new Set(filtered.map((o) => o.id))
                  )
                }
                className="font-bold text-blue-600"
              >
                {selected.size === filtered.length ? t("Снять все") : t("Выбрать все")}
              </button>
            </div>
          )}
          {filtered.map((o) => {
            const st = STATUS[o.status || "new"] || STATUS.new;
            const StIcon = st.icon;
            const isSelected = selected.has(o.id);
            return (
              <div
                key={o.id}
                onClick={() =>
                  selectMode ? toggleSelected(o.id) : navigate(`/order/${o.id}`)
                }
                className={cn(
                  "bg-white rounded-2xl p-4 border shadow-sm space-y-3 cursor-pointer transition-colors",
                  selectMode && isSelected
                    ? "border-neutral-900 ring-2 ring-neutral-800"
                    : "border-neutral-200 hover:border-neutral-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {selectMode &&
                      (isSelected ? (
                        <CheckSquare className="w-5 h-5 text-neutral-900 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-neutral-400 shrink-0" />
                      ))}
                    {o.order_number && (
                      <span className="text-xs font-bold text-neutral-400">
                        {o.order_number}
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
                        st.cls
                      )}
                    >
                      <StIcon className="w-3 h-3" />
                      {t(st.label)}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fmtDate(o.created_date)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-neutral-800 font-medium leading-snug">
                      {o.what_needed}
                    </p>
                  </div>
                  {(o.grade || o.cubes) && (
                    <div className="text-xs text-neutral-500 pl-6">
                      {o.grade}
                      {o.grade && o.cubes ? " · " : ""}
                      {o.cubes ? t("{n} куб", { n: o.cubes }) : ""}
                      {o.order_type === "calculator" && o.price_per_cube
                        ? ` · ${o.price_per_cube.toLocaleString(locale())} ${t("₸/куб")}`
                        : ""}
                    </div>
                  )}
                  {o.delivery_address && (
                    <div className="text-xs text-neutral-500 pl-6">
                      {t("Адрес:")} {o.delivery_address}
                      {o.delivery_lat != null && o.delivery_lng != null && (
                        <a
                          href={`https://www.google.com/maps?q=${o.delivery_lat},${o.delivery_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 text-blue-600 underline font-semibold"
                        >
                          {t("на карте")}
                        </a>
                      )}
                    </div>
                  )}
                  {o.comment && (
                    <div className="text-xs text-neutral-500 pl-6 italic">
                      {t("Комментарий:")} {o.comment}
                    </div>
                  )}
                  {o.needed_by && (
                    <div className="text-xs font-bold text-red-600 pl-6 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t("Нужен к:")} {fmtDate(o.needed_by)}
                    </div>
                  )}
                </div>

                <a
                  href={`tel:${o.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
                >
                  <Phone className="w-4 h-4" />
                  {o.phone}
                </a>

                {o.total != null && (
                  <div className="text-right text-lg font-black text-neutral-900">
                    {o.total.toLocaleString(locale())} ₸
                  </div>
                )}

                {!selectMode && (
                <div
                  className="flex flex-wrap gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {o.status === "new" && (
                    <button
                      onClick={() => updateStatus(o.id, "in_progress")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200"
                    >
                      {t("В работу")}
                    </button>
                  )}
                  {(o.status === "new" || o.status === "in_progress") && (
                    <button
                      onClick={() => setTransferOrder(o)}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 inline-flex items-center justify-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {t("Назначить миксер")}
                    </button>
                  )}
                  {o.status === "sent_to_plant" && (
                    <button
                      onClick={() => updateStatus(o.id, "manufacturing")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 inline-flex items-center justify-center gap-1"
                    >
                      <Droplets className="w-3.5 h-3.5" />
                      {t("Начать заливку")}
                    </button>
                  )}
                  {o.status === "manufacturing" && (
                    <button
                      onClick={() => updateStatus(o.id, "en_route")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 inline-flex items-center justify-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {t("Миксер выехал")}
                    </button>
                  )}
                  {o.status !== "done" && (
                    <button
                      onClick={() => updateStatus(o.id, "done")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      {t("Завершить")}
                    </button>
                  )}
                  <button
                    onClick={() => blacklistPhone(o)}
                    className="px-3 py-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    title={t("В чёрный список")}
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(o.id)}
                    className="px-3 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 inset-x-0 z-30 px-4 max-w-md mx-auto">
          <div className="bg-neutral-900 text-white rounded-2xl shadow-lg p-3 flex items-center gap-2">
            <span className="text-xs font-bold px-1 shrink-0">
              {t("Выбрано: {n}", { n: selected.size })}
            </span>
            <button
              onClick={() => bulkUpdate("done")}
              disabled={bulkBusy}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              {bulkBusy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {t("Готово")}
            </button>
            <button
              onClick={() => bulkUpdate("cancelled")}
              disabled={bulkBusy}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
            >
              {t("Отменить")}
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkBusy}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              aria-label={t("Удалить")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <TransferToPlantDialog
        order={transferOrder}
        open={!!transferOrder}
        onOpenChange={(v) => !v && setTransferOrder(null)}
        onTransferred={load}
      />
    </div>
  );
}
