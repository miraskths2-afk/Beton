import React, { lazy, Suspense } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";

// Ленивая загрузка: браузер скачивает код только той "домашней" страницы,
// которая реально нужна этому пользователю, а не всех трёх сразу.
const Home = lazy(() => import("@/pages/Home"));
const AdminHome = lazy(() => import("@/pages/AdminHome"));
const DriverHome = lazy(() => import("@/pages/DriverHome"));

function Loader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-4 border-neutral-200 border-t-neutral-800 rounded-full animate-spin"></div>
    </div>
  );
}

export default function RoleHome() {
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);

  return (
    <Suspense fallback={<Loader />}>
      {role === "admin" ? (
        <AdminHome />
      ) : role === "driver" ? (
        <DriverHome />
      ) : (
        <Home />
      )}
    </Suspense>
  );
}
