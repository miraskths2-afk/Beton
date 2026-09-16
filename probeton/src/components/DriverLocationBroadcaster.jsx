import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { upsertMyLocation, setOffline } from "@/lib/driverLocation";
import { Navigation, NavigationOff } from "lucide-react";

// Показывается только водителям. Даёт им переключатель "На линии" —
// пока он включён, браузер каждые несколько секунд отправляет координаты
// в Supabase, и их видят заказчик (по своему заказу) и админ (все сразу).
export default function DriverLocationBroadcaster() {
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const watchIdRef = useRef(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (user?.id) setOffline(user.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goOnline = () => {
    if (!navigator.geolocation) {
      setError("Ваш браузер не поддерживает геолокацию");
      return;
    }
    setError("");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        upsertMyLocation(
          user.id,
          user.full_name || user.driver_name || "Водитель",
          pos.coords.latitude,
          pos.coords.longitude
        );
      },
      (err) => {
        console.error(err);
        setError("Не удалось получить доступ к геолокации. Разрешите доступ в настройках браузера.");
        setOnline(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    setOnline(true);
  };

  const goOffline = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (user?.id) setOffline(user.id);
    setOnline(false);
  };

  if (!user) return null;

  return (
    <div className="px-4 pt-3">
      <button
        onClick={online ? goOffline : goOnline}
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm transition-colors ${
          online
            ? "bg-green-600 text-white"
            : "bg-neutral-200 text-neutral-700"
        }`}
      >
        {online ? (
          <>
            <Navigation className="w-4 h-4" />
            На линии — местоположение видно заказчику
          </>
        ) : (
          <>
            <NavigationOff className="w-4 h-4" />
            Выйти на линию (показывать геолокацию)
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
