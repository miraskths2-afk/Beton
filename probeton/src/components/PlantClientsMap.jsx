import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PointsMap from "@/components/PointsMap";
import { plantName } from "@/lib/plants";
import { t } from "@/lib/i18n";

// Карта для завода: только объекты клиентов (свободные заявки и
// заявки завода) и сам завод. Миксеристов завод на карте не видит.
export default function PlantClientsMap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await base44.entities.Order.list("-created_date", 300);
        setOrders(
          all.filter(
            (o) =>
              o.delivery_lat != null &&
              o.delivery_lng != null &&
              o.status !== "done" &&
              o.status !== "cancelled" &&
              (o.plant_id === user?.id ||
                ((o.status || "new") === "new" && !o.driver_id && !o.plant_id))
          )
        );
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
  }, [user?.id]);

  const points = orders.map((o) => ({
    id: o.id,
    lat: o.delivery_lat,
    lng: o.delivery_lng,
    kind: o.plant_id === user?.id ? "client_mine" : "client",
    title: [o.grade, o.cubes ? t("{n} куб", { n: o.cubes }) : null].filter(Boolean).join(" · ") || t("Заказ"),
    subtitle: o.delivery_address,
    onClick: () => navigate(o.plant_id === user?.id ? `/order/${o.id}` : "/"),
    linkLabel: o.plant_id === user?.id ? t("Открыть заявку") : t("К ленте заявок"),
  }));
  if (user?.plant_lat != null && user?.plant_lng != null) {
    points.push({
      id: "me",
      lat: user.plant_lat,
      lng: user.plant_lng,
      kind: "plant",
      title: plantName(user),
      subtitle: user.plant_address,
    });
  }

  const mineCount = orders.filter((o) => o.plant_id === user?.id).length;

  return (
    <div className="space-y-2">
      <PointsMap points={points} height="55vh" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 px-1">
        <span>📍 <span className="text-blue-600 font-semibold">{t("Свободные: {n}", { n: orders.length - mineCount })}</span></span>
        <span>📍 <span className="text-amber-600 font-semibold">{t("Ваши: {n}", { n: mineCount })}</span></span>
        <span>🏭 {t("Ваш завод")}</span>
      </div>
    </div>
  );
}
