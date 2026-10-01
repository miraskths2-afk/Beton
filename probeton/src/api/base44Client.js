// Этот файл заменяет старый src/api/base44Client.js.
// Вместо подключения к серверам Base44 он работает напрямую с вашей
// собственной базой данных на Supabase.
//
// Все остальные файлы проекта, которые делают что-то вроде
//   base44.entities.Order.list(...)
//   base44.entities.Order.create(...)
// продолжат работать без изменений — мы специально сохранили те же
// названия методов.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Проверьте файл .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = {
  Order: "orders",
  Leftover: "leftovers",
  Blacklist: "blacklist",
  User: "app_users",
};

function makeEntity(table) {
  return {
    async list(sort, limit) {
      let query = supabase.from(table).select("*");
      if (sort) {
        const desc = sort.startsWith("-");
        const column = desc ? sort.slice(1) : sort;
        query = query.order(column, { ascending: !desc });
      } else {
        query = query.order("created_date", { ascending: false });
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async create(fields) {
      const { data, error } = await supabase
        .from(table)
        .insert(fields)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, fields) {
      const { data, error } = await supabase
        .from(table)
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return true;
    },

    // Возвращает функцию отписки, как и раньше в Base44.
    subscribe(callback) {
      const channel = supabase
        .channel(`realtime:${table}:${Math.random()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          callback
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

const USERS_TABLE = TABLES.User;
const CURRENT_PHONE_KEY = "probeton_current_phone";

function cleanPhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

async function findOrCreateUserByPhone(phone, extra = {}) {
  const phoneDigits = cleanPhone(phone);
  if (!phoneDigits) throw new Error("Введите номер телефона");

  const { data: existing, error: findError } = await supabase
    .from(USERS_TABLE)
    .select("*")
    .eq("phone", phoneDigits)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from(USERS_TABLE)
    .insert({
      phone: phoneDigits,
      role: "user",
      // Заказчик получает доступ сразу при первом входе. Водителю, как и
      // раньше, для первого входа нужно одобрение диспетчера.
      approval_status: extra.account_type === "driver" ? "pending" : "approved",
      ...extra,
    })
    .select()
    .single();
  if (createError) throw createError;
  return created;
}

export const base44 = {
  entities: {
    Order: makeEntity(TABLES.Order),
    Leftover: makeEntity(TABLES.Leftover),
    Blacklist: makeEntity(TABLES.Blacklist),
    User: makeEntity(TABLES.User),
  },

  // Больше нет отдельного бэкенда с "публичными настройками" — просто
  // возвращаем пустую заглушку, чтобы старый код, который её ждёт,
  // не сломался.
  app: {
    async getPublicSettings() {
      return { id: "local", public_settings: {} };
    },
  },

  auth: {
    // Новый упрощённый вход: только по номеру телефона, без пароля.
    async loginWithPhone(phone, extra = {}) {
      const user = await findOrCreateUserByPhone(phone, extra);
      localStorage.setItem(CURRENT_PHONE_KEY, user.phone);
      return user;
    },

    async me() {
      const phone = localStorage.getItem(CURRENT_PHONE_KEY);
      if (!phone) {
        const err = new Error("Не авторизован");
        err.status = 401;
        throw err;
      }
      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      if (error || !data) {
        localStorage.removeItem(CURRENT_PHONE_KEY);
        const err = new Error("Не авторизован");
        err.status = 401;
        throw err;
      }
      return data;
    },

    async updateMe(fields) {
      const phone = localStorage.getItem(CURRENT_PHONE_KEY);
      if (!phone) throw new Error("Не авторизован");
      const { data, error } = await supabase
        .from(USERS_TABLE)
        .update(fields)
        .eq("phone", phone)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async logout() {
      const phone = localStorage.getItem(CURRENT_PHONE_KEY);
      if (phone) {
        try {
          // При следующем входе этому номеру снова понадобится одобрение
          // диспетчера. Админов эта логика не касается.
          await supabase
            .from(USERS_TABLE)
            .update({ approval_status: "pending" })
            .eq("phone", phone)
            .neq("role", "admin");
        } catch (e) {
          console.error(e);
        }
      }
      localStorage.removeItem(CURRENT_PHONE_KEY);
    },

    isAuthenticated() {
      return !!localStorage.getItem(CURRENT_PHONE_KEY);
    },

    redirectToLogin() {
      window.location.href = "/login";
    },
  },
};
