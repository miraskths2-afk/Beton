import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ORDER_STATUSES, STATUS_FLOW, normPhone } from "@/lib/orderStatuses";
import {
  Search,
  Package,
  Truck,
  Loader2,
  Star,
  Wallet,
  QrCode,
  CheckCircle2,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Stars({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="active:scale-90 transition-transform"
        >
          <Star
            className={cn(
              "w-7 h-7",
              n <= value ? "fill-amber-400 text-amber-400" : "text-neutral-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function OrderTracking() {
  const [phone, setPhone] = useState("");
  const [activePhone, setActivePhone] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(null);
  const [ratePick, setRatePick] = useState({});

  const fetchMine = async (num) => {
    if (!num) return;
    setLoading(true);
    try {
      const all = await base44.entities.Order.list("-created_date", 200);
      const mine = all.filter((o) => normPhone(o.phone) === num);
      setOrders(mine);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const num = normPhone(phone);
    if (num.length < 6) return;
    setSearched(true);
    setActivePhone(num);
    fetchMine(num);
  };

  useEffect(() => {
    if (!activePhone) return;
    const unsub = base44.entities.Order.subscribe(() => fetchMine(activePhone));
    return unsub;
  }, [activePhone]);

  const fmtDate = (d) =>
    new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const payDone = async (id) => {
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { client_paid: true });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const rateDriver = async (id, stars) => {
    setBusy(id);
    try {
      await base44.entities.Order.update(id, { client_rating: stars });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
          <Truck className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900">Отслеживание заказа</h2>
          <p className="text-xs text-neutral-500">
            Введите ваш телефон — статус и оплата в реальном времени
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          className="h-11"
        />
        <Button
          type="submit"
          disabled={loading}
          className="bg-neutral-900 text-white h-11 px-4"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </form>

      {searched && !loading && orders.length === 0 && (
        <div className="text-center py-8 text-neutral-400">
          <Package className="w-9 h-9 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Заказов по этому номеру не найдено</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = ORDER_STATUSES[o.status || "new"];
            const currentIdx = STATUS_FLOW.indexOf(o.status || "new");
            const isEnRoute = o.status === "en_route";
            const isDone = o.status === "done";
            const commission = (o.cubes || 0) * 1000;
            const material =
              o.total != null ? Math.max(o.total - commission, 0) : null;

            return (
              <div
                key={o.id}
                className={cn(
                  "rounded-xl border p-4 space-y-3",
                  isDone
                    ? "border-neutral-300 bg-white"
                    : isEnRoute
                    ? "border-green-400 bg-green-50"
                    : "border-neutral-200 bg-neutral-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-900">
                    {o.order_number || "Заказ"}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-1 rounded-lg text-xs font-bold",
                      st.cls
                    )}
                  >
                    {st.label}
                  </span>
                </div>

                {isEnRoute && (
                  <div className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-3 py-2.5">
                    <Truck className="w-5 h-5" />
                    <span className="font-bold text-sm">
                      Миксер выехал — ожидайте подачи!
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FLOW.map((s, i) => (
                    <span
                      key={s}
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                        i <= currentIdx
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-200 text-neutral-400"
                      )}
                    >
                      {ORDER_STATUSES[s].label}
                    </span>
                  ))}
                </div>

                {isDone && (
                  <div className="space-y-3 pt-1">
                    <div className="rounded-xl border border-neutral-200 p-3 space-y-1">
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                        Блок А · Оплата за материал водителю
                      </div>
                      <div className="text-lg font-black text-neutral-900">
                        {material != null
                          ? `${material.toLocaleString("ru-RU")} ₸`
                          : "по договорённости"}
                      </div>
                      <div className="text-xs text-neutral-500">
                        Переведите сумму напрямую водителю на Kaspi Gold или по
                        его реквизитам.
                      </div>
                      {o.driver_name && (
                        <div className="text-xs text-neutral-600">
                          Водитель: {o.driver_name}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                        Блок Б · Сервисный сбор PROBETON
                      </div>
                      <div className="text-lg font-black text-neutral-900">
                        {commission.toLocaleString("ru-RU")} ₸
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {o.cubes || 0} куб × 1 000 ₸
                      </div>

                      <div className="flex flex-col items-center justify-center bg-white border border-dashed border-amber-300 rounded-lg p-4">
                        <QrCode className="w-16 h-16 text-neutral-800" />
                        <div className="text-[10px] text-neutral-500 mt-1">
                          Kaspi QR — реквизиты PROBETON
                        </div>
                      </div>
                      <div className="text-[10px] text-neutral-400 leading-snug">
                        Оплачивая счёт, вы подтверждаете выполнение информационных
                        услуг платформой в полном объёме.
                      </div>

                      {o.commission_paid ? (
                        <div className="flex items-center justify-center gap-2 text-sm font-bold text-green-600 bg-green-100 rounded-lg py-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Оплата подтверждена
                        </div>
                      ) : o.client_paid ? (
                        <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-600 bg-amber-100 rounded-lg py-2">
                          <Hourglass className="w-4 h-4 animate-pulse" />
                          Ожидает подтверждения диспетчером
                        </div>
                      ) : (
                        <Button
                          onClick={() => payDone(o.id)}
                          disabled={busy === o.id}
                          className="w-full bg-amber-400 hover:bg-amber-300 text-neutral-900 font-bold h-11"
                        >
                          {busy === o.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Я оплатил"
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                        Оцените водителя
                      </div>
                      {o.client_rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-neutral-500">
                            Ваша оценка: {o.client_rating}★
                          </span>
                        </div>
                      ) : (
                        <Stars
                          value={ratePick[o.id] || 0}
                          onChange={(n) => {
                            setRatePick((p) => ({ ...p, [o.id]: n }));
                            rateDriver(o.id, n);
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {!isDone && (
                  <div className="text-xs text-neutral-500">
                    Создан: {fmtDate(o.created_date)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
