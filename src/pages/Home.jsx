import React, { useState } from "react";
import QuickOrderForm from "@/components/QuickOrderForm";
import ConcreteCalculator from "@/components/ConcreteCalculator";
import OrderTracking from "@/components/OrderTracking";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "quick", label: "Быстрый заказ" },
  { id: "calc", label: "Калькулятор" },
  { id: "track", label: "Мой заказ" },
];

export default function Home() {
  const [tab, setTab] = useState("quick");

  return (
    <div className="p-4 space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white p-5 shadow-md">
        <h1 className="text-xl font-black leading-tight">
          🏗️ PROBETON — Доставка бетона в Алматы и Алматинской области
        </h1>
        <ul className="mt-4 space-y-3">
          <li className="flex gap-2.5 text-sm leading-snug">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>
              <span className="font-bold">Марки бетона:</span> строго по ГОСТу от
              М150 до М400.
            </span>
          </li>
          <li className="flex gap-2.5 text-sm leading-snug">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>
              <span className="font-bold">Доставка:</span> день в день напрямую с
              ближайшего сертифицированного РБУ (Каскелен, Талгар, ГРЭС,
              Рыскулова).
            </span>
          </li>
          <li className="flex gap-2.5 text-sm leading-snug">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>
              <span className="font-bold">Спецтехника:</span> аренда
              автобетононасосов (АБН) со стрелой от 16 до 52 метров.
            </span>
          </li>
          <li className="flex gap-2.5 text-sm leading-snug">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>
              <span className="font-bold">Условия:</span> Честный объем, полный
              пакет документов, оплата через Kaspi.
            </span>
          </li>
        </ul>
        <div className="flex gap-2 mt-4 flex-wrap">
          {["М150", "М200", "М300", "М400"].map((m) => (
            <span
              key={m}
              className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-semibold backdrop-blur-sm"
            >
              {m}
            </span>
          ))}
        </div>
      </section>

      <p className="text-center text-sm font-semibold text-neutral-700 px-2">
        👇 Введите параметры, и свободные заводы Алматинской области сразу начнут
        подготовку вашего миксера!
      </p>

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
