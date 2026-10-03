// Минимальный service worker — нужен только чтобы браузер разрешил
// "Установить как приложение". Намеренно НИЧЕГО не кэширует, чтобы
// заказы, карта и другие живые данные всегда оставались актуальными
// и не "залипали" в старой версии после обновления сайта.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// ===== Уведомления на телефон (Web Push) =====
// Приходят даже когда сайт закрыт. Кэширования по-прежнему нет.
// Если сайт сейчас открыт на экране — системное уведомление не нужно:
// передаём его странице, она покажет всплывашку внутри приложения.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "ПРОБЕТОН", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ПРОБЕТОН";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const visible = list.find((c) => c.visibilityState === "visible");
      if (visible) {
        visible.postMessage({ type: "push", title, body: data.body || "", url: data.url || "/" });
        return undefined;
      }
      return self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag || undefined,
        renotify: !!data.tag,
        data: { url: data.url || "/" },
      });
    })
  );
});

// Нажали на уведомление — открываем нужную страницу (заказ, баланс, чат).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => c.url.startsWith(self.location.origin));
      if (win) {
        return win.focus().then((c) => (c && "navigate" in c ? c.navigate(url) : undefined));
      }
      return self.clients.openWindow(url);
    })
  );
});
