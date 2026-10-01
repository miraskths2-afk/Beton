// Подробности заявки: способ выгрузки, лоток, дозаказ, «с документами»,
// примерное число машин, рейсы, таймер простоя.
// Колонки и функции в базе — supabase_order_details.sql.
import { supabase } from "@/api/base44Client";
import { t } from "@/lib/i18n";

// Средняя вместимость миксера для расчёта «примерно N машин».
export const MIXER_CAPACITY = 8;

export const UNLOAD_METHODS = {
  slide: "Слив на землю",
  pump: "В автобетононасос",
};

export const ORDER_PHOTOS_BUCKET = "order-photos";

export function trucksEstimate(cubes) {
  const n = Number(cubes) || 0;
  if (n <= 0) return 0;
  return Math.max(1, Math.ceil(n / MIXER_CAPACITY));
}

// 1 машина, 2 машины, 5 машин
export function trucksText(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return t("{n} машина", { n });
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t("{n} машины", { n });
  return t("{n} машин", { n });
}

export function unloadText(o) {
  if (!o?.unload_method) return "";
  let s = t(UNLOAD_METHODS[o.unload_method] || o.unload_method);
  if (o.unload_method === "slide") {
    s += o.chute_needed
      ? ` · ${t("нужен лоток ~{m} м", { m: o.chute_meters || "?" })}`
      : ` · ${t("без лотка")}`;
  }
  return s;
}

// Понятная ошибка, если supabase_order_details.sql ещё не выполнен.
export function orderDetailsErrorText(err) {
  const msg = String(err?.message || err || "");
  if (
    /(unload_method|chute_|may_reorder|reorder_of|with_documents|site_photo_url|access_confirmed|arrived_at|downtime_|trip_no|trips_total|parent_order_id)/.test(msg) ||
    /(assign_order_mixers|mark_arrived|finish_unloading)/.test(msg) ||
    /bucket not found/i.test(msg)
  ) {
    return t("В базе нет новых полей заявки. Выполните файл supabase_order_details.sql в Supabase → SQL Editor.");
  }
  return msg || t("Ошибка");
}

// Уменьшаем фото с телефона (часто 3–5 МБ) до ~1600 px, чтобы
// загрузка шла быстро и на слабом интернете.
async function shrinkImage(file, maxSide = 1600) {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    return blob || file;
  } catch {
    return file;
  }
}

export async function uploadSitePhoto(file) {
  const blob = await shrinkImage(file);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(ORDER_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(ORDER_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function assignOrderMixers(plantId, orderId, items) {
  const { data, error } = await supabase.rpc("assign_order_mixers", {
    p_plant_id: plantId,
    p_order_id: orderId,
    p_items: items,
  });
  if (error) throw error;
  return data;
}

export async function markArrived(driverId, orderId) {
  const { data, error } = await supabase.rpc("mark_arrived", {
    p_driver_id: driverId,
    p_order_id: orderId,
  });
  if (error) throw error;
  return data;
}

export async function finishUnloading(driverId, orderId) {
  const { data, error } = await supabase.rpc("finish_unloading", {
    p_driver_id: driverId,
    p_order_id: orderId,
  });
  if (error) throw error;
  return data;
}

// Сколько платных часов набежало к моменту now (для живого таймера).
// Та же формула, что в finish_unloading: каждый начатый час сверх
// бесплатного времени.
export function downtimeNow(o, now = Date.now()) {
  if (!o?.arrived_at) return { minutes: 0, hours: 0, fee: 0 };
  const end = o.unloaded_at ? new Date(o.unloaded_at).getTime() : now;
  const minutes = Math.max(0, (end - new Date(o.arrived_at).getTime()) / 60000);
  const extra = minutes - (o.downtime_free_minutes ?? 60);
  const hours = extra > 0 ? Math.ceil(extra / 60) : 0;
  return { minutes, hours, fee: hours * Number(o.downtime_rate || 0) };
}

