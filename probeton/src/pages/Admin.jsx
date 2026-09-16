import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Phone,
  Package,
  Clock,
  CheckCircle2,
  Loader,
  Trash2,
  Factory,
  Droplets,
  Truck,
  Send,
  Ban,
} from "lucide-react";
import TransferToPlantDialog from "@/components/TransferToPlantDialog";
import DriverApproval from "@/components/DriverApproval";
import CommissionApproval from "@/components/CommissionApproval";
import LiveDriverMap from "@/components/LiveDriverMap";

const STATUS = {
  new: { label: "Поиск машины", icon: Inbox, cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "В работе", icon: Loader, cls: "bg-amber-100 text-amber-700" },
  sent_to_plant: { label: "Передано на завод", icon: Factory, cls: "bg-purple-100 text-purple-700" },
  manufacturing: { label: "Бетон изготавливается", icon: Droplets, cls: "bg-orange-100 text-orange-700" },
  en_route: { label: "Машина в пути", icon: Truck, cls: "bg-green-100 text-green-700" },
  done: { label: "Готов", icon: CheckCircle2, cls: "bg-green-100 text-green-700" },
};

export default function Admin() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
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

  const filtered =
    filter === "all" ? orders : orders.filter((o) => (o.status || "new") === filter);

  const counts = {
    all: orders.length,
    new: orders.filter((o) => (o.status || "new") === "new").length,
    in_progress: orders.filter((o) => o.status === "in_progress").length,
    done: orders.filter((o) => o.status === "done").length,
  };

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
        <h1 className="text-xl font-black text-neutral-900">
          Здравствуйте, {user?.full_name || "администратор"}
        </h1>
        <p className="text-sm text-neutral-500">Все входящие заявки</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-neutral-900 px-1">Водители на линии</h2>
        <LiveDriverMap />
      </div>

      <DriverApproval />
      <CommissionApproval />

      <div className="grid grid-cols-4 gap-2">
        {[
          { id: "all", label: "Все" },
          { id: "new", label: "Новые" },
          { id: "in_progress", label: "В работе" },
          { id: "done", label: "Готово" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id)}
            className={cn(
              "rounded-xl py-2 px-1 text-center transition-all border",
              filter === s.id
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200"
            )}
          >
            <div className="text-lg font-black tabular-nums">{counts[s.id]}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide">
              {s.label}
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
          <p className="text-sm">Заказов пока нет</p>
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
                  {o.order_type === "calculator" && (
                    <div className="text-xs text-neutral-500 pl-6">
                      {o.grade} · {o.cubes} куб · {o.price_per_cube?.toLocaleString("ru-RU")} ₸/куб
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

                {o.order_type === "calculator" && o.total != null && (
                  <div className="text-right text-lg font-black text-neutral-900">
                    {o.total.toLocaleString("ru-RU")} ₸
                  </div>
                )}

                <div className="flex gap-2 pt-1">
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
                      На завод
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
