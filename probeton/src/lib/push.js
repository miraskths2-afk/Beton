// Уведомления на телефон (Web Push).
//
// Как это работает: браузер выдаёт «адрес» этого устройства (подписку),
// мы сохраняем его в push_subscriptions вместе с id пользователя и языком.
// Дальше база сама решает, кому что прислать (триггеры в
// supabase_push.sql), а функция Supabase "push" отправляет уведомление —
// оно приходит, даже если сайт закрыт.
//
// Где работает: Android (Chrome и др.), компьютеры. На iPhone — только
// если сайт установлен на экран «Домой» (iOS 16.4 и новее); в обычной
// вкладке Safari уведомлений на iPhone нет — это ограничение Apple.

import { supabase } from "@/api/base44Client";
import { getLang } from "@/lib/i18n";

const TABLE = "push_subscriptions";
const ON_KEY = "probeton_push_on";

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Push на этом устройстве включён — тогда старые «браузерные» уведомления
// дублировать не нужно.
export function isPushOn() {
  try {
    return localStorage.getItem(ON_KEY) === "1";
  } catch {
    return false;
  }
}

function setPushOn(on) {
  try {
    if (on) localStorage.setItem(ON_KEY, "1");
    else localStorage.removeItem(ON_KEY);
  } catch {
    // игнорируем
  }
}

function keyToBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

async function saveSubscription(user, sub) {
  const json = sub.toJSON();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      lang: getLang(),
      user_agent: (navigator.userAgent || "").slice(0, 200),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

// Подписать это устройство. Разрешение спрашивает браузер — вызывать
// только по нажатию кнопки (на iPhone иначе запрос не покажется).
// Возвращает: "on" | "denied" | "unsupported" | "error".
export async function enablePush(user) {
  if (!user?.id) return "error";
  if (!isPushSupported()) return "unsupported";
  try {
    const perm =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (perm !== "granted") return "denied";

    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { data: publicKey, error } = await supabase.rpc("push_public_key");
      if (error || !publicKey) throw error || new Error("Нет ключа push");
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(publicKey),
      });
    }
    await saveSubscription(user, sub);
    setPushOn(true);
    return "on";
  } catch (e) {
    console.error(e);
    return "error";
  }
}

// При каждом входе: если разрешение уже дано — тихо обновляем подписку
// (вдруг на этом телефоне теперь другой аккаунт или другой язык).
export async function syncPush(user) {
  if (!user?.id || !isPushSupported()) return;
  if (Notification.permission !== "granted") {
    setPushOn(false);
    return;
  }
  if (user.notifications_enabled === false) return;
  await enablePush(user);
}

// Отписать это устройство (выход из аккаунта, выключили уведомления).
export async function disablePush() {
  setPushOn(false);
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from(TABLE).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch (e) {
    console.error(e);
  }
}
