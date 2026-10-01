// Чат «миксерист ↔ клиент» по заказу или по остатку из Кубовика.
//
// Все сообщения лежат в одной таблице order_messages (см. supabase_chat.sql):
// у сообщения заполнено либо order_id (обычная заявка), либо leftover_id
// (Кубовик). Админ видит все чаты и может написать как «Диспетчер».
//
// Номера телефонов собеседникам не показываем: ни в чате, ни в карточках.
// Если кто-то пишет номер в сообщении — у собеседника он скрывается
// (админ видит текст как есть). Это защита в интерфейсе: вход без пароля
// и открытые правила базы не позволяют спрятать номер на уровне самой базы.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/api/base44Client";
import { normPhone } from "@/lib/orderStatuses";
import { t } from "@/lib/i18n";

export const CHAT_TABLE = "order_messages";

export const ROLE_LABEL = {
  client: "Заказчик",
  driver: "Миксерист",
  admin: "Диспетчер",
  plant: "Завод",
};

export function chatColumn(kind) {
  return kind === "leftover" ? "leftover_id" : "order_id";
}

export function chatPath(kind, id) {
  return `/chat/${kind}/${id}`;
}

// Кем пользователь является в этом чате. null — посторонний (чат не открываем).
export function getChatRole(user, kind, item) {
  if (!user || !item) return null;
  if (user.role === "admin") return "admin";
  if (item.driver_id && user.id === item.driver_id) return "driver";
  const myPhone = normPhone(user.phone);
  if (kind === "order") {
    if (user.account_type === "plant" && item.plant_id === user.id) return "plant";
    if (myPhone && normPhone(item.phone) === myPhone) return "client";
    return null;
  }
  if (myPhone && normPhone(item.intercepted_by_phone) === myPhone) return "client";
  return null;
}

// Можно ли уже переписываться: у заказа есть миксерист, у остатка — тот,
// кто его перехватил.
export function chatAvailable(kind, item) {
  if (!item) return false;
  return kind === "leftover" ? !!item.intercepted_by_phone : !!item.driver_id;
}

// Похожие на телефон последовательности (10+ цифр, с пробелами/скобками/
// дефисами) заменяем заглушкой.
const PHONE_RE = /\+?\d[\d\s\-().]{7,}\d/g;
export function maskPhones(text) {
  if (!text) return text;
  return text.replace(PHONE_RE, (m) =>
    m.replace(/\D/g, "").length >= 10 ? t("[номер скрыт]") : m
  );
}

export function displayText(message, viewerRole) {
  return viewerRole === "admin" ? message : maskPhones(message);
}

// Короткий текст для списков и уведомлений.
export function previewText(m, viewerRole) {
  if (!m) return "";
  if (m.audio_url) return t("🎤 Голосовое сообщение");
  return displayText(m.message, viewerRole);
}

export const VOICE_LABEL = "🎤 Голосовое сообщение";
export const VOICE_BUCKET = "chat-voice";

// Загружает запись голоса в Storage и возвращает публичную ссылку.
export async function uploadVoice(blob, kind, id) {
  const type = blob.type || "audio/webm";
  const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const path = `${kind}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(path, blob, { contentType: type.split(";")[0], upsert: false });
  if (error) throw error;
  return supabase.storage.from(VOICE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function sendChatMessage({ kind, id, user, role, name, message, audioUrl, audioDuration }) {
  const { data, error } = await supabase
    .from(CHAT_TABLE)
    .insert({
      [chatColumn(kind)]: id,
      sender_id: user?.id || null,
      sender_role: role,
      sender_name: name,
      message,
      ...(audioUrl ? { audio_url: audioUrl, audio_duration: audioDuration ?? null } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Отмечает входящие сообщения прочитанными. Админ, читающий чужую
// переписку, галочки не ставит.
export async function markChatRead(kind, id, role) {
  if (!role || role === "admin") return;
  const { error } = await supabase
    .from(CHAT_TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq(chatColumn(kind), id)
    .neq("sender_role", role)
    .is("read_at", null);
  if (error) console.error(error);
}

const ORDER_FIELDS =
  "id, order_number, phone, driver_id, driver_name, status, grade, cubes, what_needed, delivery_address, created_date";
const LEFTOVER_FIELDS =
  "id, grade, cubes, direction, price, phone, driver_id, driver_name, intercepted_by_phone, status, created_date";

async function safe(query) {
  const { data, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function orderTitle(o, role) {
  const num = o.order_number ? `№${o.order_number}` : t("Заказ");
  if (role === "client") return o.driver_name || t("Миксерист");
  if (role === "admin") return `${t("Заказ")} ${num}`;
  return `${t("Заказчик")} · ${num}`;
}

function leftoverTitle(l, role) {
  if (role === "client") return l.driver_name || t("Миксерист");
  if (role === "admin") return `${t("Кубовик")} · ${l.grade || ""}`;
  return t("Прораб (Кубовик)");
}

function itemSubtitle(kind, item, role) {
  const cubes = item.cubes ? t("{n} куб", { n: item.cubes }) : "";
  const gc = [item.grade, cubes].filter(Boolean).join(" · ");
  if (kind === "leftover") {
    if (role === "admin")
      return `${item.driver_name || t("Миксерист")} ↔ ${t("Прораб")} · ${cubes}`;
    return [t("Кубовик"), gc].filter(Boolean).join(" · ");
  }
  if (role === "admin")
    return `${item.driver_name || t("Миксерист")} ↔ ${t("Заказчик")}${gc ? " · " + gc : ""}`;
  const num = role === "client" && item.order_number ? `№${item.order_number}` : "";
  return [num, gc].filter(Boolean).join(" · ") || item.what_needed || "";
}

function isActive(kind, item) {
  if (kind === "leftover") return item.status === "intercepted";
  return item.status !== "done" && item.status !== "cancelled";
}

// Список чатов пользователя (как список переписок в WhatsApp):
// последнее сообщение, число непрочитанных, сортировка по времени.
export async function loadMyChats(user) {
  if (!user) return [];
  const isAdmin = user.role === "admin";
  let orders = [];
  let leftovers = [];
  let preMessages = null;

  if (isAdmin) {
    preMessages = await safe(
      supabase
        .from(CHAT_TABLE)
        .select("id, order_id, leftover_id, sender_role, sender_name, message, audio_url, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(2000)
    );
    const oIds = [...new Set(preMessages.map((m) => m.order_id).filter(Boolean))];
    const lIds = [...new Set(preMessages.map((m) => m.leftover_id).filter(Boolean))];
    [orders, leftovers] = await Promise.all([
      oIds.length ? safe(supabase.from("orders").select(ORDER_FIELDS).in("id", oIds)) : [],
      lIds.length ? safe(supabase.from("leftovers").select(LEFTOVER_FIELDS).in("id", lIds)) : [],
    ]);
  } else if (user.account_type === "driver") {
    [orders, leftovers] = await Promise.all([
      safe(
        supabase
          .from("orders")
          .select(ORDER_FIELDS)
          .eq("driver_id", user.id)
          .order("created_date", { ascending: false })
          .limit(300)
      ),
      safe(
        supabase
          .from("leftovers")
          .select(LEFTOVER_FIELDS)
          .eq("driver_id", user.id)
          .not("intercepted_by_phone", "is", null)
          .order("created_date", { ascending: false })
          .limit(300)
      ),
    ]);
  } else if (user.account_type === "plant") {
    orders = await safe(
      supabase
        .from("orders")
        .select(ORDER_FIELDS + ", plant_id")
        .eq("plant_id", user.id)
        .not("driver_id", "is", null)
        .order("created_date", { ascending: false })
        .limit(300)
    );
  } else {
    const mine = normPhone(user.phone);
    const [o, l] = await Promise.all([
      safe(
        supabase
          .from("orders")
          .select(ORDER_FIELDS)
          .not("driver_id", "is", null)
          .order("created_date", { ascending: false })
          .limit(1000)
      ),
      safe(
        supabase
          .from("leftovers")
          .select(LEFTOVER_FIELDS)
          .not("intercepted_by_phone", "is", null)
          .order("created_date", { ascending: false })
          .limit(1000)
      ),
    ]);
    orders = o.filter((x) => mine && normPhone(x.phone) === mine);
    leftovers = l.filter((x) => mine && normPhone(x.intercepted_by_phone) === mine);
  }

  let messages = preMessages;
  if (!messages) {
    const oIds = orders.map((o) => o.id);
    const lIds = leftovers.map((l) => l.id);
    const fields = "id, order_id, leftover_id, sender_role, sender_name, message, audio_url, created_at, read_at";
    const [mo, ml] = await Promise.all([
      oIds.length
        ? safe(
            supabase
              .from(CHAT_TABLE)
              .select(fields)
              .in("order_id", oIds)
              .order("created_at", { ascending: false })
              .limit(2000)
          )
        : [],
      lIds.length
        ? safe(
            supabase
              .from(CHAT_TABLE)
              .select(fields)
              .in("leftover_id", lIds)
              .order("created_at", { ascending: false })
              .limit(2000)
          )
        : [],
    ]);
    messages = [...mo, ...ml];
  }

  const byKey = {};
  messages.forEach((m) => {
    const key = m.leftover_id ? `leftover:${m.leftover_id}` : `order:${m.order_id}`;
    (byKey[key] ||= []).push(m);
  });

  const build = (kind, item) => {
    const role = isAdmin ? "admin" : getChatRole(user, kind, item);
    if (!role) return null;
    const key = `${kind}:${item.id}`;
    const list = (byKey[key] || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const last = list[0] || null;
    const unread =
      role === "admin"
        ? 0
        : list.filter((m) => m.sender_role !== role && !m.read_at).length;
    const active = isActive(kind, item);
    if (!last && !active) return null;
    return {
      key,
      kind,
      id: item.id,
      role,
      title: kind === "leftover" ? leftoverTitle(item, role) : orderTitle(item, role),
      subtitle: itemSubtitle(kind, item, role),
      last,
      unread,
      active,
      sortTime: new Date(last?.created_at || item.created_date || 0).getTime(),
    };
  };

  return [
    ...orders.map((o) => build("order", o)),
    ...leftovers.map((l) => build("leftover", l)),
  ]
    .filter(Boolean)
    .sort((a, b) => b.sortTime - a.sortTime);
}

// Подписка на любые изменения в сообщениях (новые / прочитанные).
export function subscribeChatChanges(callback, filter) {
  const channel = supabase
    .channel(`chat-changes:${Math.random()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: CHAT_TABLE, ...(filter ? { filter } : {}) },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Непрочитанные сообщения в одном чате — для кнопки «Чат» с цифрой.
export function useChatUnread(kind, id, role) {
  const [count, setCount] = useState(0);
  const [last, setLast] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!id || !role) return undefined;
    const col = chatColumn(kind);
    const load = async () => {
      const { data, error } = await supabase
        .from(CHAT_TABLE)
        .select("id, sender_role, message, audio_url, created_at, read_at")
        .eq(col, id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !mounted.current) return;
      const list = data || [];
      setLast(list[0] || null);
      setCount(
        role === "admin"
          ? 0
          : list.filter((m) => m.sender_role !== role && !m.read_at).length
      );
    };
    load();
    const unsub = subscribeChatChanges(() => load(), `${col}=eq.${id}`);
    return () => {
      mounted.current = false;
      unsub();
    };
  }, [kind, id, role]);

  return { count, last };
}

// Общее число непрочитанных (значок на иконке чата в шапке) +
// уведомление о новом сообщении, если чат сейчас не открыт.
export function useTotalUnread(user, onNewMessage) {
  const [count, setCount] = useState(0);
  const chatsRef = useRef({});
  const onNewRef = useRef(onNewMessage);
  onNewRef.current = onNewMessage;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user || isAdmin) {
      setCount(0);
      return undefined;
    }
    let mounted = true;
    let timer = null;
    const load = async () => {
      try {
        const list = await loadMyChats(user);
        if (!mounted) return;
        const map = {};
        list.forEach((c) => {
          map[c.key] = c;
        });
        chatsRef.current = map;
        setCount(list.reduce((s, c) => s + c.unread, 0));
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const unsub = subscribeChatChanges((payload) => {
      const m = payload?.new;
      if (payload?.eventType === "INSERT" && m) {
        const key = `${m.leftover_id ? "leftover" : "order"}:${m.leftover_id || m.order_id}`;
        const check = () => {
          const chat = chatsRef.current[key];
          if (chat && m.sender_role !== chat.role) onNewRef.current?.({ ...chat, message: m });
          return !!chat;
        };
        // Чат мог появиться только что (миксерист недавно принял заказ) —
        // тогда сначала обновляем список, потом проверяем ещё раз.
        if (!check()) {
          load().then(check);
          return;
        }
      }
      clearTimeout(timer);
      timer = setTimeout(load, 500);
    });
    return () => {
      mounted = false;
      clearTimeout(timer);
      unsub();
    };
  }, [user, isAdmin]);

  return count;
}
