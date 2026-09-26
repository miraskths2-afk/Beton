import React, { useCallback, useEffect, useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  Truck,
  MapPin,
  LayoutDashboard,
  ClipboardList,
  List,
  BarChart3,
  Flame,
  UserCircle,
  Sun,
  Moon,
} from "lucide-react";
import { queryClientInstance } from "@/lib/query-client";
import { t, getLang, setLang } from "@/lib/i18n";
import { getTheme, setTheme, watchSystemTheme } from "@/lib/theme";
import PullToRefresh from "@/components/PullToRefresh";
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
  { to: "/balance", label: "Статистика", icon: BarChart3, end: false, roles: ["driver"] },
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
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  // Ключ страницы: при "потяните, чтобы обновить" меняем его — страница
  // создаётся заново и заново загружает свежие данные из базы.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const stop = watchSystemTheme();
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      stop();
      obs.disconnect();
    };
  }, []);

  const toggleTheme = () => {
    // Быстрый переключатель в шапке: явно светлая или тёмная.
    // Вариант "как в телефоне" — в Профиле → Настройки.
    const current = getTheme();
    const darkNow = current === "dark" || (current === "system" && isDark);
    setTheme(darkNow ? "light" : "dark");
  };

  const handleRefresh = useCallback(async () => {
    queryClientInstance.invalidateQueries();
    setRefreshKey((k) => k + 1);
    // Небольшая пауза, чтобы индикатор не мигнул слишком быстро.
    await new Promise((r) => setTimeout(r, 600));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="app-header sticky top-0 z-30 bg-neutral-900 text-white px-5 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center text-neutral-900">
            <MixerIcon className="w-5 h-5" />
          </div>
          <div className="leading-none">
            <div className="font-black text-lg tracking-tight">PROBETON</div>
            <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">
              {role === "driver"
                ? t("Кабинет партнёра")
                : role === "admin"
                ? t("Диспетчер")
                : t("Биржа бетона")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-300 font-medium hidden sm:block">
            {t("Алматинская область")}
          </div>
          <button
            onClick={() => setLang(getLang() === "kk" ? "ru" : "kk")}
            className="h-8 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-black tracking-wide"
            aria-label={t("Сменить язык")}
            title={t("Сменить язык")}
          >
            {getLang() === "kk" ? "KZ" : "RU"}
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label={isDark ? t("Светлая тема") : t("Тёмная тема")}
            title={isDark ? t("Светлая тема") : t("Тёмная тема")}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {role === "driver" && <DriverLocationBroadcaster />}

      <main className="flex-1 pb-24 max-w-md w-full mx-auto">
        <PullToRefresh onRefresh={handleRefresh}>
          <Outlet key={refreshKey} />
        </PullToRefresh>
      </main>

      <nav className="app-nav fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-200 max-w-md mx-auto">
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
                  <span className="text-[11px] font-semibold">{t(label)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
