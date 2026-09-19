import React, { useState } from "react";
import QuickOrderForm from "@/components/QuickOrderForm";
import ConcreteCalculator from "@/components/ConcreteCalculator";
import OrderTracking from "@/components/OrderTracking";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

const TABS = [
  { id: "quick", label: "Быстрый заказ" },
  { id: "calc", label: "Калькулятор" },
  { id: "track", label: "Мой заказ" },
];

export default function Home() {
  const { user } = useAuth();
  const [tab, setTab] = useState("quick");

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
        <QuickOrderForm />
      ) : tab === "calc" ? (
        <ConcreteCalculator />
      ) : (
        <OrderTracking />
      )}
    </div>
  );
}
