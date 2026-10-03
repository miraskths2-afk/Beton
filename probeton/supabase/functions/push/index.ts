// Supabase Edge Function "push" — рассылает уведомления на телефоны.
//
// Её вызывает сама база (функция push_notify в supabase_push.sql) через
// pg_net, когда в заказах, балансе, чате и т.п. происходит событие.
// Запрос: { users: uuid[], key, params, url, tag } + заголовок
// x-push-secret (сверяется с push_config.secret — посторонний не сможет
// рассылать уведомления от имени сайта).
//
// Тексты — здесь, на русском и казахском: язык берётся тот, что выбран
// на устройстве при подписке (push_subscriptions.lang).
//
// Как обновить: задеплоить заново эту папку (Supabase → Edge Functions),
// "Verify JWT" выключен — проверка идёт по секрету.

import { sendPush } from "./webpush.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type P = Record<string, string | boolean | undefined>;
type Msg = (p: P) => { title: string; body: string };

const who = (p: P, lang: string) =>
  lang === "kk" ? (p.pump ? "Сорғышы" : "Миксерші") : p.pump ? "Насосник" : "Миксерист";
const vol = (p: P) => [p.grade, p.cubes ? `${p.cubes} м³` : ""].filter(Boolean).join(", ");
const what = (p: P, lang: string) =>
  p.pump
    ? "АБН" + (p.hours ? ` ${p.hours} ${lang === "kk" ? "сағ" : "ч"}` : "")
    : vol(p);
const join = (...parts: (string | undefined | boolean)[]) => parts.filter(Boolean).join(" — ");

const RU: Record<string, Msg> = {
  new_order: (p) => ({
    title: p.pump ? "Новая заявка на АБН" : "Новая заявка",
    body: join(what(p, "ru"), p.address as string),
  }),
  admin_new_order: (p) => ({
    title: `Новая заявка №${p.n}`,
    body: join(what(p, "ru"), p.address as string),
  }),
  assigned: (p) => ({ title: "Вам назначен заказ", body: join(`№${p.n}`, what(p, "ru"), p.address as string) }),
  unassigned: (p) => ({ title: "Заказ снят с вас", body: `Диспетчер снял с вас заказ №${p.n}` }),
  accepted: (p) => ({
    title: "Заказ принят!",
    body: `${who(p, "ru")} ${p.name || ""} принял ваш заказ №${p.n}`.replace(/\s+/g, " "),
  }),
  en_route: (p) => ({ title: "Машина в пути", body: `${who(p, "ru")} ${p.name || ""} выехал к вам`.replace(/\s+/g, " ") }),
  eta15: (p) => ({
    title: "Скоро приедет",
    body: `${who(p, "ru")} ${p.name || ""} будет у вас примерно через 15 минут`.replace(/\s+/g, " "),
  }),
  arrived: (p) => ({ title: "Машина на объекте", body: `${who(p, "ru")} приехал на объект` }),
  unloaded: (p) => ({
    title: "Работа выполнена",
    body: `Заказ №${p.n} выполнен. Оплатите сервисный сбор и оцените работу`,
  }),
  done: (p) => ({ title: "Заказ выполнен", body: `Заказ №${p.n} выполнен. Оцените работу исполнителя` }),
  client_payment_confirmed: (p) => ({ title: "Оплата подтверждена", body: `Диспетчер подтвердил оплату по заказу №${p.n}. Спасибо!` }),
  driver_payment_confirmed: (p) => ({ title: "Заказ закрыт", body: `Диспетчер подтвердил оплату сбора — заказ №${p.n} завершён` }),
  cancelled: (p) => ({ title: "Заказ отменён", body: `Заказ №${p.n} отменён` }),
  admin_client_paid: (p) => ({ title: "Заказчик оплатил сбор", body: `Заказ №${p.n} — проверьте и подтвердите` }),
  admin_driver_paid: (p) => ({ title: "Водитель оплатил сбор", body: `${p.name || "Водитель"}, заказ №${p.n} — проверьте и подтвердите` }),
  admin_cancel_request: (p) => ({ title: "Просят отменить заказ", body: `Заказ №${p.n} — ${p.name || "исполнитель"} просит отмену` }),
  admin_topup_request: (p) => ({ title: "Заявка на пополнение", body: `${p.name}: ${p.amount} ₸ — проверьте и подтвердите` }),
  topup_confirmed: (p) => ({ title: "Баланс пополнен", body: `+${p.amount} ₸ зачислено на баланс` }),
  topup_rejected: (p) => ({ title: "Пополнение отклонено", body: `Заявка на ${p.amount} ₸ отклонена. Свяжитесь с диспетчером` }),
  balance_charge: (p) => ({ title: "Списание с баланса", body: join(`−${p.amount} ₸`, p.note as string) }),
  balance_credit: (p) => ({ title: "Начисление на баланс", body: join(`+${p.amount} ₸`, p.note as string) }),
  account_approved: () => ({ title: "Аккаунт одобрен", body: "Диспетчер одобрил ваш аккаунт — можно работать" }),
  account_rejected: () => ({ title: "Аккаунт не одобрен", body: "Свяжитесь с диспетчером" }),
  admin_new_user: (p) => ({ title: "Новый водитель ждёт одобрения", body: (p.name as string) || "" }),
  warning: (p) => ({ title: "Вам выдано предупреждение", body: `Всего предупреждений: ${p.count} из 3` }),
  leftover_taken: (p) => ({ title: "Ваш остаток забрали", body: join(vol(p), "откройте, чтобы связаться") }),
  chat_message: (p) => ({ title: `Сообщение: ${p.name || "чат"}`, body: (p.text as string) === "🎤" ? "🎤 Голосовое сообщение" : (p.text as string) }),
  admin_complaint: (p) => ({ title: "Новая жалоба", body: join(p.name as string, p.text as string) }),
};

const KK: Record<string, Msg> = {
  new_order: (p) => ({
    title: p.pump ? "АБН-ға жаңа өтінім" : "Жаңа өтінім",
    body: join(what(p, "kk"), p.address as string),
  }),
  admin_new_order: (p) => ({ title: `Жаңа өтінім №${p.n}`, body: join(what(p, "kk"), p.address as string) }),
  assigned: (p) => ({ title: "Сізге тапсырыс берілді", body: join(`№${p.n}`, what(p, "kk"), p.address as string) }),
  unassigned: (p) => ({ title: "Тапсырыс сізден алынды", body: `Диспетчер №${p.n} тапсырысты сізден алды` }),
  accepted: (p) => ({
    title: "Тапсырыс қабылданды!",
    body: `${who(p, "kk")} ${p.name || ""} №${p.n} тапсырысыңызды қабылдады`.replace(/\s+/g, " "),
  }),
  en_route: (p) => ({ title: "Көлік жолда", body: `${who(p, "kk")} ${p.name || ""} сізге шықты`.replace(/\s+/g, " ") }),
  eta15: (p) => ({
    title: "Жақында келеді",
    body: `${who(p, "kk")} ${p.name || ""} шамамен 15 минуттан кейін келеді`.replace(/\s+/g, " "),
  }),
  arrived: (p) => ({ title: "Көлік объектіде", body: `${who(p, "kk")} объектіге келді` }),
  unloaded: (p) => ({ title: "Жұмыс аяқталды", body: `№${p.n} тапсырыс орындалды. Сервистік алымды төлеп, жұмысты бағалаңыз` }),
  done: (p) => ({ title: "Тапсырыс орындалды", body: `№${p.n} тапсырыс орындалды. Орындаушыны бағалаңыз` }),
  client_payment_confirmed: (p) => ({ title: "Төлем расталды", body: `Диспетчер №${p.n} тапсырыс бойынша төлемді растады. Рахмет!` }),
  driver_payment_confirmed: (p) => ({ title: "Тапсырыс жабылды", body: `Диспетчер алым төлемін растады — №${p.n} тапсырыс аяқталды` }),
  cancelled: (p) => ({ title: "Тапсырыс болдырылмады", body: `№${p.n} тапсырыс болдырылмады` }),
  admin_client_paid: (p) => ({ title: "Тапсырыс беруші алымды төледі", body: `№${p.n} тапсырыс — тексеріп, растаңыз` }),
  admin_driver_paid: (p) => ({ title: "Жүргізуші алымды төледі", body: `${p.name || "Жүргізуші"}, №${p.n} тапсырыс — тексеріп, растаңыз` }),
  admin_cancel_request: (p) => ({ title: "Тапсырысты болдырмау сұралды", body: `№${p.n} тапсырыс — ${p.name || "орындаушы"} болдырмауды сұрайды` }),
  admin_topup_request: (p) => ({ title: "Толтыру өтінімі", body: `${p.name}: ${p.amount} ₸ — тексеріп, растаңыз` }),
  topup_confirmed: (p) => ({ title: "Баланс толтырылды", body: `Балансқа +${p.amount} ₸ түсті` }),
  topup_rejected: (p) => ({ title: "Толтыру қабылданбады", body: `${p.amount} ₸ өтінімі қабылданбады. Диспетчерге хабарласыңыз` }),
  balance_charge: (p) => ({ title: "Баланстан шегерілді", body: join(`−${p.amount} ₸`, p.note as string) }),
  balance_credit: (p) => ({ title: "Балансқа түсті", body: join(`+${p.amount} ₸`, p.note as string) }),
  account_approved: () => ({ title: "Аккаунт расталды", body: "Диспетчер аккаунтыңызды растады — жұмыс істей беріңіз" }),
  account_rejected: () => ({ title: "Аккаунт расталмады", body: "Диспетчерге хабарласыңыз" }),
  admin_new_user: (p) => ({ title: "Жаңа жүргізуші растауды күтуде", body: (p.name as string) || "" }),
  warning: (p) => ({ title: "Сізге ескерту берілді", body: `Барлық ескерту: ${p.count} / 3` }),
  leftover_taken: (p) => ({ title: "Қалдығыңызды алды", body: join(vol(p), "байланысу үшін ашыңыз") }),
  chat_message: (p) => ({ title: `Хабарлама: ${p.name || "чат"}`, body: (p.text as string) === "🎤" ? "🎤 Дауыстық хабарлама" : (p.text as string) }),
  admin_complaint: (p) => ({ title: "Жаңа шағым", body: join(p.name as string, p.text as string) }),
};

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`db ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  try {
    const [cfg] = await db("push_config?id=eq.1&select=*");
    if (!cfg?.secret || req.headers.get("x-push-secret") !== cfg.secret) {
      return new Response("forbidden", { status: 403 });
    }
    const { users, key, params = {}, url = "/", tag } = await req.json();
    if (!Array.isArray(users) || users.length === 0) return Response.json({ sent: 0 });

    const ids = users.filter((u: string) => /^[0-9a-f-]{36}$/i.test(u)).join(",");
    const subs = await db(`push_subscriptions?user_id=in.(${ids})&select=*`);
    const vapid = { publicKey: cfg.vapid_public, privateKey: cfg.vapid_private, subject: cfg.vapid_subject };

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string; lang: string }) => {
        const dict = s.lang === "kk" ? KK : RU;
        const msg = (dict[key] || RU[key])?.(params);
        if (!msg) return;
        try {
          const status = await sendPush(s, { ...msg, url, tag }, vapid);
          if (status === 404 || status === 410) dead.push(s.id);
          else if (status < 300) sent++;
          else console.error("push status", status, s.endpoint.slice(0, 40));
        } catch (e) {
          console.error("push error", e);
        }
      })
    );
    // Устройство отписалось или приложение удалено — забываем его.
    if (dead.length) await db(`push_subscriptions?id=in.(${dead.join(",")})`, { method: "DELETE" });
    return Response.json({ sent, removed: dead.length });
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
