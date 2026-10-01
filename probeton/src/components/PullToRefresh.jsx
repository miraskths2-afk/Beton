import React, { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

// "Потяните, чтобы обновить" — привычный мобильный жест.
// Срабатывает, только когда страница прокручена в самый верх и палец
// тянет вниз. На картах, в окнах-диалогах и внутри прокручиваемых
// блоков (например, чат) жест не мешает — там он отключён.

const THRESHOLD = 70; // сколько пикселей потянуть, чтобы обновить
const MAX_PULL = 110;

function blocksPull(target) {
  let el = target;
  while (el && el !== document.body) {
    if (el.nodeType === 1) {
      if (
        el.classList?.contains("leaflet-container") ||
        el.getAttribute?.("role") === "dialog" ||
        el.hasAttribute?.("data-no-pull")
      ) {
        return true;
      }
      // Внутренний блок с прокруткой, который уже прокручен вниз.
      if (el.scrollTop > 0) return true;
    }
    el = el.parentNode;
  }
  return false;
}

export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const onStart = (e) => {
      startY.current = null;
      if (refreshingRef.current || window.scrollY > 0) return;
      if (e.touches.length !== 1 || blocksPull(e.target)) return;
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // "Резиновое" сопротивление — тянется всё туже.
      const value = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = value;
      setPull(value);
    };

    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pullRef.current < THRESHOLD) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      setPull(48);
      try {
        await onRefreshRef.current?.();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        pullRef.current = 0;
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const ready = pull >= THRESHOLD;

  return (
    <>
      <div
        className={cn(
          "flex items-end justify-center overflow-hidden",
          startY.current == null && "transition-[height] duration-200"
        )}
        style={{ height: pull }}
        aria-hidden={pull === 0}
      >
        {pull > 0 && (
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-500">
            <RefreshCw
              className={cn("w-4 h-4", refreshing && "animate-spin")}
              style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
            />
            {refreshing
              ? t("Обновляем...")
              : ready
              ? t("Отпустите, чтобы обновить")
              : t("Потяните, чтобы обновить")}
          </div>
        )}
      </div>
      {children}
    </>
  );
}
