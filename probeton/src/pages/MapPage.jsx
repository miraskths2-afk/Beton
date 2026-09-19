import React from "react";
import AdminDriverMapSection from "@/components/AdminDriverMapSection";

// Раздел "Заводы-партнёры / РБУ" полностью убран.
// Вместо него — живая карта миксеристов, доступная и заказчику, и админу.
export default function MapPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">Миксеристы</h1>
        <p className="text-sm text-neutral-500">
          Местоположение водителей в реальном времени
        </p>
      </div>
      <AdminDriverMapSection />
    </div>
  );
}
