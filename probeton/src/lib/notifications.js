import { toast } from "@/components/ui/use-toast";
import { isPushOn } from "@/lib/push";

// Когда последний раз показывали уведомление изнутри сайта — чтобы то же
// событие, пришедшее ещё и через push, не всплывало второй раз.
let lastNotifyAt = 0;

// Запрашивает разрешение на системные уведомления браузера.
// Если браузер их не поддерживает — просто ничего не делает,
// уведомления внутри приложения (toast) всё равно будут работать.
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch (e) {
      return "denied";
    }
  }
  return Notification.permission;
}

// Показывает уведомление: всегда — всплывающее внутри самого сайта,
// и дополнительно системное уведомление браузера, если на него дано
// разрешение (тогда придёт, даже если вкладка свёрнута).
export function notify(title, description) {
  lastNotifyAt = Date.now();
  toast({ title, description });

  // Если включены уведомления на телефон (push), системное уведомление
  // пришлёт уже сам push — второе такое же не нужно.
  if (isPushOn()) return;

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: description,
        icon: "/favicon.svg",
      });
    } catch (e) {
      // Игнорируем — toast внутри приложения уже показан.
    }
  }
}

// Push пришёл, пока сайт открыт на экране: service worker не показывает
// системное уведомление, а передаёт его сюда — показываем всплывашку.
// Если только что уже показали своё уведомление о том же — пропускаем.
let listening = false;
export function listenForPushMessages() {
  if (listening || !("serviceWorker" in navigator)) return;
  listening = true;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const d = event.data;
    if (!d || d.type !== "push") return;
    if (Date.now() - lastNotifyAt < 8000) return;
    toast({ title: d.title, description: d.body });
  });
}
