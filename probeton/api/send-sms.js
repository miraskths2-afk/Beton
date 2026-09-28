// Отправка SMS-кода для входа.
//
// Supabase Auth сам генерирует код и вызывает этот адрес
// (Auth -> Hooks -> Send SMS hook -> HTTPS). Мы проверяем подпись
// Supabase и отправляем SMS через казахстанского провайдера.
//
// Переменные окружения (Vercel -> Settings -> Environment Variables):
//   SEND_SMS_HOOK_SECRET  — секрет хука из Supabase (вида v1,whsec_...)
//   SMS_PROVIDER          — "smsc" (smsc.kz) или "mobizon" (mobizon.kz)
//   SMSC_LOGIN, SMSC_PASSWORD — для smsc.kz
//   MOBIZON_API_KEY           — для mobizon.kz
//   SMS_SENDER            — имя отправителя (необязательно, если не
//                           зарегистрировано у провайдера — не указывайте)
import crypto from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

function verifySignature(rawBody, headers) {
  const secret = (process.env.SEND_SMS_HOOK_SECRET || "").replace(/^v1,whsec_/, "");
  if (!secret) throw new Error("SEND_SMS_HOOK_SECRET не задан");

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature") || "";
  if (!id || !timestamp) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = crypto
    .createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

async function sendViaSmsc(phone, text) {
  const params = new URLSearchParams({
    login: process.env.SMSC_LOGIN || "",
    psw: process.env.SMSC_PASSWORD || "",
    phones: phone,
    mes: text,
    charset: "utf-8",
    fmt: "3",
  });
  if (process.env.SMS_SENDER) params.set("sender", process.env.SMS_SENDER);
  const res = await fetch("https://smsc.kz/sys/send.php", {
    method: "POST",
    body: params,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`SMSC: ${data.error || res.status}`);
  }
}

async function sendViaMobizon(phone, text) {
  const url = new URL("https://api.mobizon.kz/service/message/sendsmsmessage");
  url.searchParams.set("output", "json");
  url.searchParams.set("api", "v1");
  url.searchParams.set("apiKey", process.env.MOBIZON_API_KEY || "");
  const body = new URLSearchParams({ recipient: phone, text });
  if (process.env.SMS_SENDER) body.set("from", process.env.SMS_SENDER);
  const res = await fetch(url, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || Number(data.code) !== 0) {
    throw new Error(`Mobizon: ${data.message || res.status}`);
  }
}

function hookError(status, message) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

export async function POST(request) {
  const rawBody = await request.text();

  let valid = false;
  try {
    valid = verifySignature(rawBody, request.headers);
  } catch (e) {
    console.error(e);
    return hookError(500, "SMS-сервис не настроен");
  }
  if (!valid) return hookError(401, "Неверная подпись");

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return hookError(400, "Неверный запрос");
  }

  const phone = (payload?.user?.phone || "").replace(/\D/g, "");
  const otp = payload?.sms?.otp;
  if (!phone || !otp) return hookError(400, "Нет номера или кода");

  const text = `Код входа ПРОБЕТОН: ${otp}. Никому его не сообщайте.`;

  try {
    if ((process.env.SMS_PROVIDER || "smsc").toLowerCase() === "mobizon") {
      await sendViaMobizon(phone, text);
    } else {
      await sendViaSmsc(phone, text);
    }
  } catch (e) {
    console.error(e);
    return hookError(502, "Не удалось отправить SMS");
  }

  return Response.json({});
}
