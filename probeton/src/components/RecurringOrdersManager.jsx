import React, { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Repeat, Trash2, Pause, Play, X, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { normPhone } from "@/lib/orderStatuses";
import { isBlacklisted } from "@/lib/blacklist";
import VoiceInputButton, { appendSpoken } from "@/components/VoiceInputButton";

const LocationPicker = lazy(() => import("@/components/LocationPicker"));

const GRADES = ["М150", "М200", "М300", "М400"];

// 1 = понедельник ... 7 = воскресенье (так же считает база).
const WEEKDAYS = [
  { id: 1, short: "Пн" },
  { id: 2, short: "Вт" },
  { id: 3, short: "Ср" },
  { id: 4, short: "Чт" },
  { id: 5, short: "Пт" },
  { id: 6, short: "Сб" },
  { id: 7, short: "Вс" },
];

const TABLE = "recurring_orders";

// Запускает создание заявок по расписанию прямо сейчас. Функция в базе
// сама следит, чтобы не было дублей, поэтому вызывать её можно сколько
// угодно раз. Ошибки молча игнорируем — основной запуск идёт по таймеру
// в Supabase (pg_cron).
export async function runRecurringNow() {
  try {
    const { data, error } = await supabase.rpc("generate_recurring_orders");
    if (error) throw error;
    return data || 0;
  } catch (e) {
    console.warn("generate_recurring_orders:", e?.message || e);
    return null;
  }
}

function weekdaysText(days) {
  const list = WEEKDAYS.filter((d) => (days || []).includes(d.id)).map((d) => t(d.short));
  if (list.length === 7) return t("каждый день");
  return list.join(", ");
}

const emptyForm = (phone) => ({
  phone: phone || "",
  grade: "М200",
  cubes: "",
  address: "",
  location: null,
  comment: "",
  weekdays: [1],
  time: "09:00",
});

// phone — если задан, это режим заказчика: видны и создаются только
// правила на его номер. Без phone — режим админа (все правила).
export default function RecurringOrdersManager({ phone, clientName }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyForm(phone));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const isClient = !!phone;

  const load = async () => {
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_date", { ascending: false });
      if (err) throw err;
      const list = data || [];
      setRules(isClient ? list.filter((r) => normPhone(r.phone) === normPhone(phone)) : list);
      setError("");
    } catch (e) {
      console.error(e);
      setError(
        t("Не удалось загрузить расписание. Возможно, в Supabase ещё не запущен файл supabase_recurring_orders.sql.")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [phone]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (id) =>
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(id)
        ? f.weekdays.filter((d) => d !== id)
        : [...f.weekdays, id].sort(),
    }));

  const isValid =
    Number(form.cubes) > 0 &&
    form.address.trim() &&
    form.phone.trim() &&
    form.weekdays.length > 0 &&
    /^\d{2}:\d{2}$/.test(form.time);

  const save = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    if (await isBlacklisted(form.phone.trim())) {
      alert(t("Этот номер в чёрном списке PROBETON. Заказ недоступен."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.from(TABLE).insert({
        phone: form.phone.trim(),
        client_name: clientName || null,
        grade: form.grade,
        cubes: parseFloat(form.cubes),
        delivery_address: form.address.trim(),
        delivery_lat: form.location?.lat ?? null,
        delivery_lng: form.location?.lng ?? null,
        comment: form.comment.trim() || null,
        weekdays: form.weekdays,
        delivery_time: form.time,
        active: true,
        created_by: isClient ? "client" : "admin",
      });
      if (err) throw err;
      setForm(emptyForm(phone));
      setShowForm(false);
      await load();
      // Если ближайшая подача уже в пределах суток — заявка появится сразу.
      runRecurringNow();
    } catch (err) {
      console.error(err);
      setError(t("Не удалось сохранить. Проверьте подключение и попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule) => {
    try {
      const { error: err } = await supabase
        .from(TABLE)
        .update({ active: !rule.active })
        .eq("id", rule.id);
      if (err) throw err;
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    } catch (e) {
      console.error(e);
    }
  };

  const remove = async (rule) => {
    if (!confirm(t("Удалить это расписание? Уже созданные заявки останутся."))) return;
    try {
      const { error: err } = await supabase.from(TABLE).delete().eq("id", rule.id);
      if (err) throw err;
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e) {
      console.error(e);
    }
  };

  const runNow = async () => {
    setRunning(true);
    const n = await runRecurringNow();
    setRunning(false);
    setRunResult(
      n == null
        ? t("Не получилось — проверьте, что SQL-файл запущен в Supabase.")
        : t("Создано новых заявок: {n}", { n })
    );
    setTimeout(() => setRunResult(null), 5000);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <Repeat className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-neutral-900 text-sm">{t("Повторяющиеся заказы")}</h2>
          <p className="text-xs text-neutral-500">
            {t("Настройте один раз — заявка будет создаваться сама за сутки до подачи.")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4 text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {rules.length === 0 && !showForm && (
            <p className="text-xs text-neutral-400 text-center py-2">
              {t("Пока нет ни одного расписания")}
            </p>
          )}
          {rules.map((r) => (
            <div
              key={r.id}
              className={cn(
                "rounded-xl border p-3 space-y-1",
                r.active ? "border-neutral-200" : "border-neutral-100 opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-neutral-900">
                  {r.grade} · {t("{n} куб", { n: r.cubes })}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(r)}
                    className="p-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    title={r.active ? t("Поставить на паузу") : t("Включить")}
                  >
                    {r.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                    title={t("Удалить")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-neutral-600">
                {weekdaysText(r.weekdays)} · {t("к {time}", { time: r.delivery_time })}
                {!r.active && ` · ${t("на паузе")}`}
              </div>
              {r.delivery_address && (
                <div className="text-xs text-neutral-500">{r.delivery_address}</div>
              )}
              {!isClient && <div className="text-xs text-neutral-500">{r.phone}</div>}
            </div>
          ))}
        </>
      )}

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {showForm ? (
        <form onSubmit={save} className="space-y-3 pt-2 border-t border-neutral-100">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">{t("Марка бетона")}</Label>
              <Select value={form.grade} onValueChange={(v) => set("grade", v)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">{t("Кубов")}</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={form.cubes}
                onChange={(e) => set("cubes", e.target.value)}
                placeholder={t("Напр. 5")}
                className="h-10"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">{t("Дни недели")}</Label>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  className={cn(
                    "h-9 rounded-lg text-xs font-bold border",
                    form.weekdays.includes(d.id)
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "bg-white text-neutral-600 border-neutral-200"
                  )}
                >
                  {t(d.short)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">
              {t("Время подачи бетона")}
            </Label>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
              className="h-10"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">
              {t("Адрес / место доставки")}
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder={t("Напр.: Наурызбайский р-н, ул. Абая 10")}
                className="h-10"
                required
              />
              <VoiceInputButton onText={(txt) => set("address", appendSpoken(form.address, txt))} />
            </div>
          </div>

          <Suspense fallback={<div className="h-[30vh] rounded-xl bg-neutral-100 animate-pulse" />}>
            <LocationPicker
              value={form.location}
              onChange={(v) => set("location", v)}
              onAddress={(a) => set("address", a)}
              height="30vh"
            />
          </Suspense>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">{t("Комментарий")}</Label>
            <div className="flex gap-2 items-start">
              <Textarea
                value={form.comment}
                onChange={(e) => set("comment", e.target.value)}
                placeholder={t("Необязательно: подъезд, ориентир, пожелания к подаче...")}
                rows={2}
                className="resize-none"
              />
              <VoiceInputButton onText={(txt) => set("comment", appendSpoken(form.comment, txt))} />
            </div>
          </div>

          {!isClient && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">
                {t("Номер телефона клиента")}
              </Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+7 (___) ___-__-__"
                className="h-10"
                required
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm(phone));
              }}
              className="flex-1 h-11 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-bold inline-flex items-center justify-center gap-1"
            >
              <X className="w-4 h-4" />
              {t("Отмена")}
            </button>
            <button
              type="submit"
              disabled={saving || !isValid}
              className="flex-1 h-11 rounded-xl bg-neutral-900 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("Сохранить")}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex-1 h-10 rounded-xl bg-neutral-900 text-white text-sm font-bold inline-flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            {t("Новое расписание")}
          </button>
          {!isClient && (
            <button
              onClick={runNow}
              disabled={running}
              className="h-10 px-3 rounded-xl border border-neutral-200 text-neutral-700 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
              title={t("Проверить расписание и создать заявки сейчас")}
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
              {t("Запустить")}
            </button>
          )}
        </div>
      )}
      {runResult && <p className="text-xs text-neutral-500 text-center">{runResult}</p>}
    </div>
  );
}
