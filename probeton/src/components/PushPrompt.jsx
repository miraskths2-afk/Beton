import React, { useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { enablePush, isIos, isPushSupported, isStandalone } from "@/lib/push";
import { t } from "@/lib/i18n";

const DISMISS_KEY = "probeton_push_prompt_hidden_at";
const HIDE_MS = 3 * 24 * 60 * 60 * 1000;

function wasDismissed() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < HIDE_MS;
  } catch {
    return false;
  }
}

// Плашка «Включите уведомления» над страницей. Показывается, пока на этом
// устройстве не спросили разрешение. На iPhone в обычной вкладке Safari
// push не работает — там подсказываем установить приложение на экран.
export default function PushPrompt() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(wasDismissed);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!user || hidden || user.notifications_enabled === false) return null;
  const iosNeedsInstall = isIos() && !isStandalone() && !isPushSupported();
  if (!iosNeedsInstall && (!isPushSupported() || Notification.permission !== "default")) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // игнорируем
    }
    setHidden(true);
  };

  const enable = async () => {
    setBusy(true);
    const res = await enablePush(user);
    setBusy(false);
    if (res === "on") setHidden(true);
    else if (res === "denied") setMsg(t("Вы запретили уведомления. Их можно разрешить в настройках браузера."));
    else setMsg(t("Не удалось включить уведомления. Попробуйте ещё раз."));
  };

  return (
    <div className="max-w-md w-full mx-auto px-4 pt-3">
      <div className="relative bg-amber-50 border border-amber-200 rounded-2xl p-3 pr-9 flex gap-3">
        <button
          onClick={dismiss}
          className="absolute top-2.5 right-2.5 text-amber-400 hover:text-amber-600"
          aria-label={t("Скрыть")}
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="text-sm font-bold text-neutral-900">
            {t("Включите уведомления")}
          </div>
          <div className="text-xs text-neutral-600">
            {iosNeedsInstall
              ? t("На iPhone уведомления приходят, только если установить приложение: «Поделиться» → «На экран «Домой»», затем открыть его с экрана.")
              : t("Сообщим о заказах, оплате и балансе, даже когда сайт закрыт.")}
          </div>
          {!iosNeedsInstall && (
            <button
              onClick={enable}
              disabled={busy}
              className="bg-neutral-900 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
            >
              {busy ? t("Включаем…") : t("Включить")}
            </button>
          )}
          {msg && <div className="text-xs text-amber-700">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
