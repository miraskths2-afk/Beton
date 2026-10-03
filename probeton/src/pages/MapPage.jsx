import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import { isPumpOrder } from "@/lib/pump";
import LiveDriverMap from "@/components/LiveDriverMap";
import { t } from "@/lib/i18n";
import { isMyOrder } from "@/lib/orderOwner";

// Кто кого видит на карте:
// - админ — всех миксеристов и насосников на линии (страница «Партнёры»);
// - заказчик — только машины своих заказов: тех, кто взял его заказ,
//   или кого назначил админ. Остальных на линии он не видит.
export default function MapPage() {
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  const [ids, setIds] = useState(null);
  const [pumpIds, setPumpIds] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (role === "client") {
          const all = await base44.entities.Order.list("-created_date", 200);
          const mine = all.filter(
            (o) =>
              o.driver_id &&
              isMyOrder(o, user) &&
              o.status !== "done" &&
              o.status !== "cancelled"
          );
          if (!mounted) return;
          setIds([...new Set(mine.map((o) => o.driver_id))]);
          setPumpIds(mine.filter(isPumpOrder).map((o) => o.driver_id));
        } else {
          setIds([]);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setIds([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [role, user?.id, user?.phone]);

  if (role === "admin") return <Navigate to="/partners" replace />;
  if (role === "driver" || role === "pump") return <Navigate to="/" replace />;

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">{t("Мои машины")}</h1>
        <p className="text-sm text-neutral-500">
          {t("Миксеры и насосы, которые везут ваши заказы, — в реальном времени")}
        </p>
      </div>
      {ids && (
        <LiveDriverMap
          driverIds={ids}
          pumpIds={pumpIds}
          height="50vh"
          emptyText={
            ids.length === 0
              ? t("Пока у вас нет заказов с назначенной машиной")
              : t("Ваши машины сейчас не на линии")
          }
        />
      )}
    </div>
  );
}
