import React from "react";
import PlantMap from "@/components/PlantMap";

export default function MapPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">Заводы-партнёры РБУ</h1>
        <p className="text-sm text-neutral-500">
          3 точки в Алматинской области — выберите ближайший
        </p>
      </div>
      <PlantMap />
    </div>
  );
}
