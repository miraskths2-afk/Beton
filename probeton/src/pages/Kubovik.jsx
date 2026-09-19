import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Droplets,
  MapPin,
  Loader2,
  Package,
  Phone,
  CheckCircle2,
  Plus,
  Flame,
  Truck,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GRADES = ["М150", "М200", "М300", "М400"];
const DURATIONS = [
  { value: 15, label: "15 минут" },
  { value: 30, label: "30 минут" },
  { value: 45, label: "45 минут" },
  { value: 60, label: "1 час" },
  { value: 90, label: "1.5 часа" },
];

function formatRemaining(ms) {
  if (ms <= 0) return "Истёк";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export default function Kubovik() {
  const { user } = useAuth();
  const isDriver = user?.account_type === "driver";
  const [leftovers, setLeftovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [grade, setGrade] = useState("М200");
  const [cubes, setCubes] = useState("");
  const [direction, setDirection] = useState("");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState("");
  const [done, setDone] = useState(false);

  const [clientPhone, setClientPhone] = useState("");
  const [revealed, setRevealed] = useState({});

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const load = async () => {
    try {
      const all = await base44.entities.Leftover.list("-created_date", 200);
      setLeftovers(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Leftover.subscribe(() => load());
    return unsub;
  }, []);

  const post = async (e) => {
    e.preventDefault();
    if (!cubes || !direction.trim() || !price || !phone.trim()) return;
    setSubmitting(true);
    setPostError("");
    try {
      await base44.entities.Leftover.create({
        grade,
        cubes: parseFloat(cubes),
        direction: direction.trim(),
        price: parseFloat(price),
        phone: phone.trim(),
        driver_id: user?.id,
        driver_name: user?.full_name || user?.driver_name || "",
        status: "available",
        expires_at: new Date(Date.now() + duration * 60000).toISOString(),
      });
      setCubes("");
      setDirection("");
      setPrice("");
      setDone(true);
      setTimeout(() => setDone(false), 3500);
    } catch (e) {
      console.error(e);
      setPostError(
        e?.message ||
          "Не удалось опубликовать остаток. Проверьте подключение и попробуйте ещё раз."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const intercept = async (l) => {
    if (clientPhone.trim().length < 6) {
      alert("Введите ваш номер телефона, чтобы перехватить остаток");
      return;
    }
    try {
      await base44.entities.Leftover.update(l.id, {
        status: "intercepted",
        intercepted_by_phone: clientPhone.trim(),
      });
      setRevealed((p) => ({ ...p, [l.id]: true }));
    } catch (e) {
      console.error(e);
    }
  };

  const available = leftovers.filter(
    (l) =>
      l.status === "available" &&
      (!l.expires_at || new Date(l.expires_at).getTime() > now)
  );
  const mine = leftovers.filter((l) => l.driver_id === user?.id);

  // ===== Водитель =====
  if (isDriver) {
    return (
      <div className="p-4 space-y-5">
        <div className="px-1">
          <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            КУБОВИК
          </h1>
          <p className="text-sm text-neutral-500">
            Слив горящих остатков с дороги — со скидкой
          </p>
        </div>

        {done && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-700 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Остаток опубликован — прорабам в этом районе уйдёт уведомление
          </div>
        )}

        <form
          onSubmit={post}
          className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="font-bold text-neutral-900">У меня есть остаток</h2>
              <p className="text-xs text-neutral-500">
                Заполните — и остаток улетит в ленту прорабам
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700">
              Марка бетона
            </Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="h-12 rounded-xl">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">
                Кубов
              </Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={cubes}
                onChange={(e) => setCubes(e.target.value)}
                placeholder="напр. 3"
                className="h-12 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">
                Цена, ₸
              </Label>
              <Input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="со скидкой"
                className="h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700">
              Направление / район
            </Label>
            <Input
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="напр. Талгарская трасса, Бесагаш"
              className="h-12 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" />
              Актуально сколько времени
            </Label>
            <Select
              value={String(duration)}
              onValueChange={(v) => setDuration(Number(v))}
            >
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-400">
              По истечении этого времени остаток исчезнет из ленты прорабов
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700">
              Телефон для связи
            </Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 700 000 00 00"
              className="h-12 rounded-xl"
              required
            />
          </div>

          {postError && (
            <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {postError}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Публикуем...
              </>
            ) : (
              "Опубликовать остаток"
            )}
          </Button>
        </form>

        {mine.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
              Мои остатки
            </div>
            {mine.map((l) => (
              <div
                key={l.id}
                className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-900">
                    {l.grade} · {l.cubes} куб
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold",
                      l.status === "intercepted"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {l.status === "intercepted" ? "Перехвачен" : "В ленте"}
                  </span>
                </div>
                <div className="text-sm text-neutral-600 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {l.direction}
                </div>
                <div className="text-sm font-black text-orange-600 mt-1">
                  {l.price?.toLocaleString("ru-RU")} ₸
                </div>
                {l.status === "available" && l.expires_at && (
                  <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" />
                    Осталось: {formatRemaining(new Date(l.expires_at).getTime() - now)}
                  </div>
                )}
                {l.status === "intercepted" && l.intercepted_by_phone && (
                  <a
                    href={`tel:${l.intercepted_by_phone}`}
                    className="mt-2 flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
                  >
                    <Phone className="w-4 h-4" />
                    Прораб: {l.intercepted_by_phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== Прораб / Заказчик =====
  return (
    <div className="p-4 space-y-5">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          КУБОВИК
        </h1>
        <p className="text-sm text-neutral-500">
          Горящие остатки бетона со скидкой — перехватите ближайший
        </p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-2">
        <Label className="text-sm font-semibold text-neutral-700">
          Ваш телефон (для перехвата)
        </Label>
        <Input
          type="tel"
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          placeholder="+7 700 000 00 00"
          className="h-12 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Загрузка остатков...
        </div>
      ) : available.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Свободных остатков пока нет</p>
          <p className="text-xs mt-1">Как только водители сольют остаток — он появится здесь</p>
        </div>
      ) : (
        <div className="space-y-3">
          {available.map((l) => {
            const isRevealed = revealed[l.id];
            return (
              <div
                key={l.id}
                className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-neutral-900 text-lg">
                    {l.grade} · {l.cubes} куб
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-700">
                    <Flame className="w-3 h-3" /> Горит
                  </span>
                </div>
                {l.expires_at && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold">
                    <Timer className="w-3.5 h-3.5" />
                    Осталось: {formatRemaining(new Date(l.expires_at).getTime() - now)}
                  </div>
                )}
                <div className="flex items-start gap-2 text-sm text-neutral-600">
                  <MapPin className="w-4 h-4 mt-0.5 text-neutral-400" />
                  {l.direction}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-orange-600">
                    {l.price?.toLocaleString("ru-RU")} ₸
                  </span>
                  <span className="text-xs text-neutral-400">цена со скидкой</span>
                </div>

                {isRevealed ? (
                  <a
                    href={`tel:${l.phone}`}
                    className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2.5"
                  >
                    <Phone className="w-4 h-4" />
                    Позвонить водителю: {l.phone}
                  </a>
                ) : (
                  <Button
                    onClick={() => intercept(l)}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-11 rounded-xl inline-flex items-center justify-center gap-1"
                  >
                    <Truck className="w-4 h-4" />
                    Перехватить остаток
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
