import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import AdminDriverMapSection from "@/components/AdminDriverMapSection";
import OfflineDriversList from "@/components/OfflineDriversList";
import PlantClientsMap from "@/components/PlantClientsMap";
import { t } from "@/lib/i18n";

// Раздел "Заводы-партнёры / РБУ" полностью убран.
// Вместо него — живая карта миксеристов, доступная и заказчику, и админу.
// Заказчик видит только точки на карте — без номера телефона и без
// госномера машины; звонить и наблюдать за конкретным миксеристом
// может только админ.
export default function MapPage() {
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  const showContact = role === "admin";

  // Завод не видит миксеристов на карте — только объекты клиентов.
  if (role === "plant") {
    return (
      <div className="p-4 space-y-4">
        <div className="px-1">
          <h1 className="text-xl font-black text-neutral-900">{t("Клиенты на карте")}</h1>
          <p className="text-sm text-neutral-500">
            {t("Объекты свободных заявок и заявок вашего завода")}
          </p>
        </div>
        <PlantClientsMap />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">{t("Миксеристы")}</h1>
        <p className="text-sm text-neutral-500">
          {t("Местоположение водителей в реальном времени")}
        </p>
      </div>
      <AdminDriverMapSection showContact={showContact} />

      {role === "admin" && (
        <div className="space-y-2">
          <h2 className="font-bold text-neutral-900 px-1 text-sm">
            {t("Водители не на линии")}
          </h2>
          <OfflineDriversList />
        </div>
      )}
    </div>
  );
}
