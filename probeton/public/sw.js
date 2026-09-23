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
