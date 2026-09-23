import React, { useState, useEffect } from "react";
import QuickOrderForm from "@/components/QuickOrderForm";
import ConcreteCalculator from "@/components/ConcreteCalculator";
import OrderTracking from "@/components/OrderTracking";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { normPhone } from "@/lib/orderStatuses";
import { Zap, RotateCcw } from "lucide-react";

const TABS = [
  { id: "quick", label: "Быстрый заказ" },
  { id: "calc", label: "Калькулятор" },
  { id: "track", label: "Мой заказ" },
];

export default function Home() {
  const { user } = useAuth();
  const [tab, setTab] = useState("quick");
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    if (!user?.phone) return;
    (async () => {
      try {
        const all = await base44.entities.Order.list("-created_date", 50);
        const mine = all.filter((o) => normPhone(o.phone) === normPhone(user.phone));
        if (mine.length > 0) setLastOrder(mine[0]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user?.phone]);

  const repeatOrder = () => {
    setPrefill({ ...lastOrder, phone: user.phone });
    setShowQuickForm(true);
  };

  return (
    <div className="p-4 space-y-5">
      {user?.full_name && (
        <p className="px-1 text-sm font-semibold text-neutral-700">
          Здравствуйте, {user.full_name} 👋
        </p>
      )}

      <div className="flex bg-neutral-200 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === t.id
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "quick" ? (
        showQuickForm ? (
          <QuickOrderForm prefill={prefill} />
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-neutral-900">Заказ в один клик</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Марка, кубы, адрес и телефон — мы перезвоним
              </p>
            </div>
            <button
              onClick={() => {
                setPrefill(null);
                setShowQuickForm(true);
              }}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold h-12 rounded-xl"
            >
              Заказать
            </button>
            {lastOrder && (
              <button
                onClick={repeatOrder}
                className="w-full border border-neutral-200 text-neutral-700 font-semibold h-11 rounded-xl inline-flex items-center justify-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Заказать снова: {lastOrder.grade} · {lastOrder.cubes} куб
                {lastOrder.delivery_address ? ` · ${lastOrder.delivery_address}` : ""}
              </button>
            )}
          </div>
        )
      ) : tab === "calc" ? (
        <ConcreteCalculator />
      ) : (
        <OrderTracking />
      )}
    </div>
  );
}
