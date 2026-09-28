// Баланс водителя и настройки платформы. Все изменения денег идут
// через серверные функции (supabase_security_v4.sql) — браузер сам
// баланс поменять не может.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";

export async function fetchSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data || { leftover_post_fee: 0, kaspi_details: "" };
}

export async function updateSettings(fields) {
  const { data, error } = await supabase
    .from("app_settings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function requestTopup(amount) {
  const { data, error } = await supabase.rpc("request_topup", { p_amount: amount });
  if (error) throw error;
  return data;
}

export async function reviewTopup(id, approve) {
  const { data, error } = await supabase.rpc("review_topup", {
    p_id: id,
    p_approve: approve,
  });
  if (error) throw error;
  return data;
}

export async function publishLeftover({ grade, cubes, direction, price, phone, minutes }) {
  const { data, error } = await supabase.rpc("publish_leftover", {
    p_grade: grade,
    p_cubes: cubes,
    p_direction: direction,
    p_price: price,
    p_phone: phone,
    p_minutes: minutes,
  });
  if (error) throw error;
  return data;
}

export function formatTenge(n) {
  return `${Number(n || 0).toLocaleString("ru-RU")} ₸`;
}

// Живой баланс текущего пользователя + цена публикации остатка.
export function useWallet(userId) {
  const [balance, setBalance] = useState(null);
  const [settings, setSettings] = useState(null);
  const [topups, setTopups] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [me, s, t, tx] = await Promise.all([
        supabase.from("app_users").select("balance").eq("id", userId).maybeSingle(),
        fetchSettings(),
        supabase
          .from("balance_topups")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("balance_transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setBalance(Number(me.data?.balance || 0));
      setSettings(s);
      setTopups(t.data || []);
      setTransactions(tx.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  useEffect(() => {
    reload();
    if (!userId) return;
    const channel = supabase
      .channel(`wallet:${userId}:${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balance_topups", filter: `user_id=eq.${userId}` },
        () => reload()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_users", filter: `id=eq.${userId}` },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  return { balance, settings, topups, transactions, reload };
}
