// Заводы / БСУ и их парки миксеристов.
//
// Завод — это обычный аккаунт в app_users с account_type = "plant".
// Миксерист в парке завода — это водитель с plant_id = id завода.
// Заявка, переданная заводу, — заказ с plant_id = id завода.
// Проверки на стороне базы — в supabase_plants.sql.

import { supabase } from "@/api/base44Client";
import { normPhone } from "@/lib/orderStatuses";

export const PLANT_ACTIVE_STATUSES = ["in_progress", "sent_to_plant", "manufacturing", "en_route"];

export function plantName(p) {
  return p?.full_name || p?.phone || "Завод";
}

export function driverName(d) {
  return d?.full_name || d?.driver_name || d?.phone || "Водитель";
}

// Понятная ошибка, если supabase_plants.sql ещё не выполнен.
export function plantsErrorText(err) {
  const msg = String(err?.message || err || "");
  if (/plant_(id|lat|lng|address|active|name)/.test(msg) && /column|schema/i.test(msg)) {
    return "В базе нет колонок для заводов. Выполните файл supabase_plants.sql в Supabase → SQL Editor.";
  }
  return msg || "Ошибка";
}

export async function fetchPlants() {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("account_type", "plant")
    .order("created_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchFleet(plantId) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("plant_id", plantId)
    .order("created_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Номер в базе хранится цифрами так, как его ввели при входе
// (7701..., 8701... или 701...). Ищем по последним 10 цифрам.
export async function findUserByPhone(phone) {
  const last10 = normPhone(phone);
  if (last10.length < 10) return null;
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .like("phone", `%${last10}`);
  if (error) throw error;
  return (data || []).find((u) => normPhone(u.phone) === last10) || null;
}

// Кто из водителей сейчас на линии и кто занят незавершённым заказом.
export async function fetchDriverState(driverIds) {
  if (!driverIds.length) return { online: new Set(), busy: new Set() };
  const [{ data: locs }, { data: active }] = await Promise.all([
    supabase
      .from("driver_locations")
      .select("driver_id")
      .eq("is_online", true)
      .in("driver_id", driverIds),
    supabase
      .from("orders")
      .select("driver_id")
      .in("driver_id", driverIds)
      .not("status", "in", "(done,cancelled)"),
  ]);
  return {
    online: new Set((locs || []).map((r) => r.driver_id)),
    busy: new Set((active || []).map((r) => r.driver_id)),
  };
}
