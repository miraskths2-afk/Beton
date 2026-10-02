import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PointsMap from "@/components/PointsMap";
import { plantName, PLANT_ACTIVE_STATUSES } from "@/lib/plants";
import { fetchLocations, subscribeToLocations } from "@/lib/driverLocation";
import { t } from "@/lib/i18n";

// Карта для завода: объекты клиентов (свободные заявки и заявки
// завода) и сам завод. Миксериста завод видит только пока тот везёт
// заявку этого завода; на личной заявке или в Кубовике — нет.
export default function PlantClientsMap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [trucks, setTrucks] = useState([]);

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

  // Миксеры, которые сейчас выполняют заявки этого завода.
  const workingDriverIds = orders
    .filter((o) => o.plant_id === user?.id && o.driver_id && PLANT_ACTIVE_STATUSES.includes(o.status))
    .map((o) => o.driver_id);
  const driverKey = workingDriverIds.join(",");

  useEffect(() => {
    if (!driverKey) {
      setTrucks([]);
      return;
    }
    let mounted = true;
    const ids = driverKey.split(",");
    const load = async () => {
      const locs = await fetchLocations(ids);
      if (mounted) setTrucks(locs.filter((l) => ids.includes(l.driver_id)));
    };
    load();
    const unsub = subscribeToLocations(load);
    return () => {
      mounted = false;
      unsub();
    };
  }, [driverKey]);

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
  for (const tr of trucks) {
    const ord = orders.find((o) => o.driver_id === tr.driver_id && o.plant_id === user?.id);
    points.push({
      id: `truck-${tr.driver_id}`,
      lat: tr.lat,
      lng: tr.lng,
      kind: "truck",
      title: tr.driver_name || t("Водитель"),
      subtitle: ord?.delivery_address,
      onClick: ord ? () => navigate(`/order/${ord.id}`) : undefined,
      linkLabel: t("Открыть заявку"),
    });
  }
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
        <span>🚚 {t("Миксеры на ваших заявках: {n}", { n: trucks.length })}</span>
      </div>
    </div>
  );
}
