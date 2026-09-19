import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [transferOrder, setTransferOrder] = useState(null);

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
      await base44.entities.Order.update(id, { status });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
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
    if (!confirm(`Внести номер ${o.phone} в чёрный список?`)) return;
    try {
      await base44.entities.Blacklist.create({
        phone: o.phone,
        reason: "Нарушение / неоплата",
      });
      alert("Номер добавлен в чёрный список.");
    } catch (err) {
      console.error(err);
    }
  };

  const activeCategory = CATEGORIES.find((c) => c.id === category);
  const filtered = orders.filter((o) => activeCategory.match(o.status || "new"));

  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, orders.filter((o) => c.match(o.status || "new")).length])
  );

  const fmtDate = (d) =>
    new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">Заявки</h1>
        <p className="text-sm text-neutral-500">Все входящие заказы</p>
      </div>

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
              {c.label}
            </div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
          Загрузка заказов...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Заявок в этой категории нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const st = STATUS[o.status || "new"];
            const StIcon = st.icon;
            return (
              <div
                key={o.id}
                className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
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
                      {st.label}
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
                      {o.cubes ? `${o.cubes} куб` : ""}
                      {o.order_type === "calculator" && o.price_per_cube
                        ? ` · ${o.price_per_cube.toLocaleString("ru-RU")} ₸/куб`
                        : ""}
                    </div>
                  )}
                  {o.delivery_address && (
                    <div className="text-xs text-neutral-500 pl-6">
                      Адрес: {o.delivery_address}
                    </div>
                  )}
                  {o.comment && (
                    <div className="text-xs text-neutral-500 pl-6 italic">
                      Комментарий: {o.comment}
                    </div>
                  )}
                  {o.needed_by && (
                    <div className="text-xs font-bold text-red-600 pl-6 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Нужен к: {fmtDate(o.needed_by)}
                    </div>
                  )}
                </div>

                <a
                  href={`tel:${o.phone}`}
                  className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
                >
                  <Phone className="w-4 h-4" />
                  {o.phone}
                </a>

                {o.total != null && (
                  <div className="text-right text-lg font-black text-neutral-900">
                    {o.total.toLocaleString("ru-RU")} ₸
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {o.status === "new" && (
                    <button
                      onClick={() => updateStatus(o.id, "in_progress")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200"
                    >
                      В работу
                    </button>
                  )}
                  {(o.status === "new" || o.status === "in_progress") && (
                    <button
                      onClick={() => setTransferOrder(o)}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 inline-flex items-center justify-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Назначить миксер
                    </button>
                  )}
                  {o.status === "sent_to_plant" && (
                    <button
                      onClick={() => updateStatus(o.id, "manufacturing")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 inline-flex items-center justify-center gap-1"
                    >
                      <Droplets className="w-3.5 h-3.5" />
                      Начать заливку
                    </button>
                  )}
                  {o.status === "manufacturing" && (
                    <button
                      onClick={() => updateStatus(o.id, "en_route")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 inline-flex items-center justify-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Миксер выехал
                    </button>
                  )}
                  {o.status !== "done" && (
                    <button
                      onClick={() => updateStatus(o.id, "done")}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      Завершить
                    </button>
                  )}
                  <button
                    onClick={() => blacklistPhone(o)}
                    className="px-3 py-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    title="В чёрный список"
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
              </div>
            );
          })}
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
