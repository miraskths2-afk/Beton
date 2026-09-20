import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  Truck,
  MapPin,
  LayoutDashboard,
  ClipboardList,
  List,
  Wallet,
  Flame,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import { cn } from "@/lib/utils";
import DriverLocationBroadcaster from "@/components/DriverLocationBroadcaster";
import MixerIcon from "@/components/MixerIcon";

const ALL_ITEMS = [
  { to: "/", label: "Заказ", icon: Truck, end: true, roles: ["client"] },
  { to: "/kubovik", label: "Остатки", icon: Flame, end: false, roles: ["client"] },
  { to: "/mapa", label: "Карта", icon: MapPin, end: false, roles: ["client"] },
  { to: "/", label: "Лента", icon: List, end: true, roles: ["driver"] },
  { to: "/kubovik", label: "Остатки", icon: Flame, end: false, roles: ["driver"] },
  { to: "/balance", label: "Баланс", icon: Wallet, end: false, roles: ["driver"] },
  { to: "/", label: "Главная", icon: LayoutDashboard, end: true, roles: ["admin"] },
  { to: "/orders", label: "Заявки", icon: ClipboardList, end: false, roles: ["admin"] },
  { to: "/kubovik", label: "Остатки", icon: Flame, end: false, roles: ["admin"] },
  { to: "/mapa", label: "Карта", icon: MapPin, end: false, roles: ["admin"] },
  { to: "/profile", label: "Профиль", icon: UserCircle, end: false, roles: ["client", "driver", "admin"] },
];

export default function Layout() {
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  const items = ALL_ITEMS.filter((it) => it.roles.includes(role));

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-neutral-900 text-white px-5 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center text-neutral-900">
            <MixerIcon className="w-5 h-5" />
          </div>
          <div className="leading-none">
            <div className="font-black text-lg tracking-tight">PROBETON</div>
            <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">
              {role === "driver"
                ? "Кабинет партнёра"
                : role === "admin"
                ? "Диспетчер"
                : "Биржа бетона"}
            </div>
          </div>
        </div>
        <div className="text-xs text-neutral-300 font-medium hidden sm:block">
          Алматинская область
        </div>
      </header>

      {role === "driver" && <DriverLocationBroadcaster />}

      <main className="flex-1 pb-24 max-w-md w-full mx-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-200 max-w-md mx-auto">
        <div className="flex">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
                  isActive
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-transform",
                      isActive && "scale-110"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="text-[11px] font-semibold">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
