import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import FleetManager from "@/components/FleetManager";
import { t } from "@/lib/i18n";

// «Парк» завода: миксеристы, прикреплённые к этому заводу.
export default function PlantFleet() {
  const { user, viewMode } = useAuth();
  if (getEffectiveRole(user, viewMode) !== "plant") return <Navigate to="/" replace />;

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">{t("Парк миксеров")}</h1>
        <p className="text-sm text-neutral-500">
          {t("Добавляйте миксеристов по номеру телефона. Оплату сбора по-прежнему подтверждает админ.")}
        </p>
      </div>
      <FleetManager plantId={user.id} />
    </div>
  );
}
