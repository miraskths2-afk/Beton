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
const ROLE_KEY = "probeton_role";

// Приводит любой ввод ("8 700 123 45 67", "+7(700)1234567", "7001234567")
// к международному виду +77001234567, который ждёт Supabase Auth.
export function toE164(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length < 10) return null;
  return "+7" + last10;
}

function notAuthorized() {
  const err = new Error("Не авторизован");
  err.status = 401;
  return err;
}

// Находит (или создаёт при первом входе) запись в app_users для номера,
// подтверждённого SMS-кодом. Всё решается на сервере — см.
// claim_account в supabase_security_v4.sql.
async function claimAccount() {
  const accountType = localStorage.getItem(ROLE_KEY) || "client";
  const { data, error } = await supabase.rpc("claim_account", {
    p_account_type: accountType,
  });
  if (error) throw error;
  return data;
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
    // Шаг 1 входа: отправить SMS с кодом на номер.
    async sendCode(phone) {
      const e164 = toE164(phone);
      if (!e164) throw new Error("Введите корректный номер телефона");
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) throw error;
      return e164;
    },

    // Шаг 2 входа: проверить код из SMS и открыть аккаунт.
    async verifyCode(phone, code) {
      const e164 = toE164(phone);
      const { error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: (code || "").trim(),
        type: "sms",
      });
      if (error) throw error;
      return claimAccount();
    },

    async me() {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw notAuthorized();
      try {
        const user = await claimAccount();
        if (!user) throw notAuthorized();
        return user;
      } catch (e) {
        console.error(e);
        throw notAuthorized();
      }
    },

    async updateMe(fields) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Не авторизован");
      const { data, error } = await supabase
        .from(USERS_TABLE)
        .update(fields)
        .eq("auth_id", auth.user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async logout() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user) {
          // При следующем входе этому номеру снова понадобится одобрение
          // диспетчера. Админов эта логика не касается.
          await supabase
            .from(USERS_TABLE)
            .update({ approval_status: "pending" })
            .eq("auth_id", auth.user.id)
            .neq("role", "admin");
        }
      } catch (e) {
        console.error(e);
      }
      await supabase.auth.signOut();
    },

    redirectToLogin() {
      window.location.href = "/login";
    },
  },
};
