import React, { useState } from "react";
import QuickOrderForm from "@/components/QuickOrderForm";
import ConcreteCalculator from "@/components/ConcreteCalculator";
import OrderTracking from "@/components/OrderTracking";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { Zap } from "lucide-react";

const TABS = [
  { id: "quick", label: "Быстрый заказ" },
  { id: "calc", label: "Калькулятор" },
  { id: "track", label: "Мой заказ" },
];

export default function Home() {
  const { user } = useAuth();
  const [tab, setTab] = useState("quick");
  const [showQuickForm, setShowQuickForm] = useState(false);

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
          <QuickOrderForm />
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
              onClick={() => setShowQuickForm(true)}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold h-12 rounded-xl"
            >
              Заказать
            </button>
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
