import { supabase } from "@/api/base44Client";

// Проверка идёт на сервере (функция is_blacklisted) — сам чёрный список
// в браузер больше не отдаётся.
export async function isBlacklisted(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return false;
  try {
    const { data, error } = await supabase.rpc("is_blacklisted", { p_phone: digits });
    if (error) throw error;
    return !!data;
  } catch (e) {
    return false;
  }
}
