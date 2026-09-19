import { toast } from "@/components/ui/use-toast";

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
  toast({ title, description });

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
