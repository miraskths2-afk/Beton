import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import { Truck, Construction } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import AdminDriverMapSection from "@/components/AdminDriverMapSection";
import OfflineDriversList from "@/components/OfflineDriversList";
import PumpRatesSettings from "@/components/PumpRatesSettings";

const TABS = [
  { id: "drivers", label: "Миксеристы", icon: Truck },
  { id: "pumps", label: "АБН", icon: Construction },
];

// Миксеристы и насосники АБН — на одной странице. Сверху переключатель,
// кого смотреть. Выбор запоминается в адресе (?tab=), чтобы «Назад»
// возвращал на ту же вкладку.
function DriversTab({ kind }) {
  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">
          {kind === "pump" ? t("Насосники АБН") : t("Миксеристы")}
        </h1>
        <p className="text-sm text-neutral-500">
          {t("Местоположение в реальном времени — видно только вам")}
        </p>
      </div>
      <AdminDriverMapSection kind={kind} />
      <div className="space-y-2">
        <h2 className="font-bold text-neutral-900 px-1 text-sm">
          {kind === "pump" ? t("Насосники не на линии") : t("Водители не на линии")}
        </h2>
        <OfflineDriversList kind={kind} />
      </div>
      {kind === "pump" && <PumpRatesSettings />}
    </div>
  );
}

// Страница «Партнёры» доступна только админу (в режиме просмотра «Админ»).
export default function AdminPartnersPage() {
  const { user, viewMode } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((x) => x.id === params.get("tab")) ? params.get("tab") : "drivers";
  if (getEffectiveRole(user, viewMode) !== "admin") return <Navigate to="/" replace />;
  return (
    <div>
      <div className="px-4 pt-4">
        <div className="flex bg-neutral-200 rounded-xl p-1">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setParams({ tab: tb.id }, { replace: true })}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5",
                tab === tb.id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              )}
            >
              <tb.icon className="w-4 h-4" />
              {t(tb.label)}
            </button>
          ))}
        </div>
      </div>
      <DriversTab key={tab} kind={tab === "pumps" ? "pump" : "driver"} />
    </div>
  );
}
