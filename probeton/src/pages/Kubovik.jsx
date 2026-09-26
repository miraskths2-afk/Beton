import React, { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import VoiceInputButton, { appendSpoken } from "@/components/VoiceInputButton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
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
import { normPhone } from "@/lib/orderStatuses";
import { ListSkeleton } from "@/components/Skeleton";
import { t, locale } from "@/lib/i18n";
const LazyStaticPointMap = lazy(() => import("@/components/StaticPointMap"));

const GRADES = ["М150", "М200", "М300", "М400"];
const DURATIONS = [
  { value: 15, label: "15 минут" },
  { value: 30, label: "30 минут" },
  { value: 45, label: "45 минут" },
  { value: 60, label: "1 час" },
  { value: 90, label: "1.5 часа" },
];

function formatRemaining(ms) {
  if (ms <= 0) return t("Истёк");
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return t("{h}ч {m}м", { h, m });
  if (m > 0) return t("{m}м {s}с", { m, s });
  return t("{s}с", { s });
}

export default function Kubovik() {
  const navigate = useNavigate();
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
  const [sortBy, setSortBy] = useState("new"); // "new" | "price_asc" | "price_desc"
  const [gradeFilter, setGradeFilter] = useState("all");

  const [clientPhone, setClientPhone] = useState("");
  const [revealed, setRevealed] = useState({});
  const [category, setCategory] = useState("available");
  const [driverCategory, setDriverCategory] = useState("available");

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

  const finishLeftover = async (id) => {
    try {
      await base44.entities.Leftover.update(id, {
        status: "gone",
        completed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    }
  };

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
          t("Не удалось опубликовать остаток. Проверьте подключение и попробуйте ещё раз.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentPosition = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), // отказ/ошибка — не блокируем перехват
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });

  const intercept = async (l) => {
    if (clientPhone.trim().length < 6) {
      alert(t("Введите ваш номер телефона, чтобы перехватить остаток"));
      return;
    }
    try {
      const pos = await getCurrentPosition();
      await base44.entities.Leftover.update(l.id, {
        status: "intercepted",
        intercepted_by_phone: clientPhone.trim(),
        intercepted_lat: pos?.lat ?? null,
        intercepted_lng: pos?.lng ?? null,
        intercepted_at: new Date().toISOString(),
      });
      setRevealed((p) => ({ ...p, [l.id]: true }));
    } catch (e) {
      console.error(e);
    }
  };

  // В общей ленте остаются и свободные, и уже перехваченные остатки —
  // пропадают только те, что водитель явно отметил завершёнными ("gone").
  const categorized = leftovers.filter((l) => {
    if (l.status === "available") {
      return !l.expires_at || new Date(l.expires_at).getTime() > now;
    }
    return true;
  });
  const CATEGORIES = [
    { id: "available", label: "Новые" },
    { id: "intercepted", label: "В работе" },
    { id: "gone", label: "Выполнены" },
  ];
  const catCount = (list, id) => list.filter((l) => l.status === id).length;
  const feed = categorized
    .filter((l) => l.status === category)
    .filter((l) => gradeFilter === "all" || l.grade === gradeFilter)
    .sort((a, b) => {
      if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
      if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
      return new Date(b.created_date) - new Date(a.created_date);
    });
  const mine = leftovers.filter((l) => l.driver_id === user?.id);
  const mineCategorized = mine.filter((l) => l.status === driverCategory);

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
            {t("Слив горящих остатков с дороги — со скидкой")}
          </p>
        </div>

        {done && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-700 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {t("Остаток опубликован — прорабам в этом районе уйдёт уведомление")}
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
              <h2 className="font-bold text-neutral-900">{t("У меня есть остаток")}</h2>
              <p className="text-xs text-neutral-500">
                {t("Заполните — и остаток улетит в ленту прорабам")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700">
              {t("Марка бетона")}
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
                {t("Кубов")}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={cubes}
                onChange={(e) => setCubes(e.target.value)}
                placeholder={t("напр. 3")}
                className="h-12 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">
                {t("Цена, ₸")}
              </Label>
              <Input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t("со скидкой")}
                className="h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700">
              {t("Направление / район")}
            </Label>
            <div className="flex gap-2">
              <Input
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder={t("напр. Талгарская трасса, Бесагаш")}
                className="h-12 rounded-xl"
                required
              />
              <VoiceInputButton
                className="h-12 w-12"
                onText={(txt) => setDirection((prev) => appendSpoken(prev, txt))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" />
              {t("Актуально сколько времени")}
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
                    {t(d.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-400">
              {t("По истечении этого времени остаток исчезнет из ленты прорабов")}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-700">
              {t("Телефон для связи")}
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
                {t("Публикуем...")}
              </>
            ) : (
              t("Опубликовать остаток")
            )}
          </Button>
        </form>

        {mine.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
              {t("Мои остатки")}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDriverCategory(c.id)}
                  className={cn(
                    "rounded-xl py-2 px-0.5 text-center transition-all border",
                    driverCategory === c.id
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "bg-white text-neutral-600 border-neutral-200"
                  )}
                >
                  <div className="text-base font-black tabular-nums">
                    {catCount(mine, c.id)}
                  </div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide leading-tight">
                    {t(c.label)}
                  </div>
                </button>
              ))}
            </div>
            {mineCategorized.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-sm">
                {t("В этой категории пока пусто")}
              </div>
            ) : (
              mineCategorized.map((l) => (
              <div
                key={l.id}
                onClick={() => navigate(`/leftover/${l.id}`)}
                className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm cursor-pointer hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-900">
                    {l.grade} · {t("{cubes} куб", { cubes: l.cubes })}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold",
                      l.status === "gone"
                        ? "bg-neutral-200 text-neutral-500"
                        : l.status === "intercepted"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {l.status === "gone"
                      ? t("Завершён")
                      : l.status === "intercepted"
                      ? t("Перехвачен")
                      : t("В ленте")}
                  </span>
                </div>
                <div className="text-sm text-neutral-600 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {l.direction}
                </div>
                <div className="text-sm font-black text-orange-600 mt-1">
                  {l.price?.toLocaleString(locale())} ₸
                </div>
                {l.status === "available" && l.expires_at && (
                  <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" />
                    {t("Осталось: {time}", { time: formatRemaining(new Date(l.expires_at).getTime() - now) })}
                  </div>
                )}
                {l.status === "intercepted" && l.intercepted_by_phone && (
                  <a
                    href={`tel:${l.intercepted_by_phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
                  >
                    <Phone className="w-4 h-4" />
                    {t("Прораб: {phone}", { phone: l.intercepted_by_phone })}
                  </a>
                )}
                {l.status === "intercepted" &&
                  l.intercepted_lat != null &&
                  l.intercepted_lng != null && (
                    <div className="mt-2">
                      <Suspense
                        fallback={
                          <div className="h-[28vh] rounded-xl bg-neutral-100 animate-pulse" />
                        }
                      >
                        <LazyStaticPointMap
                          lat={l.intercepted_lat}
                          lng={l.intercepted_lng}
                          label={t("Прораб: {phone}", { phone: l.intercepted_by_phone || "" })}
                        />
                      </Suspense>
                    </div>
                  )}
                {l.status === "intercepted" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      finishLeftover(l.id);
                    }}
                    className="mt-2 w-full text-xs font-bold py-2 rounded-lg bg-neutral-900 text-white inline-flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("Завершить (остаток забрали)")}
                  </button>
                )}
              </div>
              ))
            )}
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
          {t("Горящие остатки бетона со скидкой — перехватите ближайший")}
        </p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-2">
        <Label className="text-sm font-semibold text-neutral-700">
          {t("Ваш телефон (для перехвата)")}
        </Label>
        <Input
          type="tel"
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          placeholder="+7 700 000 00 00"
          className="h-12 rounded-xl"
        />
      </div>

      <div className="flex gap-2">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-10 rounded-xl flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t("Сначала новые")}</SelectItem>
            <SelectItem value="price_asc">{t("Цена: дешевле")}</SelectItem>
            <SelectItem value="price_desc">{t("Цена: дороже")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="h-10 rounded-xl flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Все марки")}</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-xl py-2 px-0.5 text-center transition-all border",
              category === c.id
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200"
            )}
          >
            <div className="text-base font-black tabular-nums">
              {catCount(categorized, c.id)}
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-wide leading-tight">
              {t(c.label)}
            </div>
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : feed.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("В этой категории пока пусто")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feed.map((l) => {
            const isRevealed = revealed[l.id];
            const isTaken = l.status === "intercepted";
            const isDone = l.status === "gone";
            const isMyIntercept =
              isTaken &&
              clientPhone &&
              normPhone(l.intercepted_by_phone) === normPhone(clientPhone);
            return (
              <div
                key={l.id}
                onClick={() => navigate(`/leftover/${l.id}`)}
                className={cn(
                  "bg-white rounded-2xl p-4 border shadow-sm space-y-2 cursor-pointer hover:border-neutral-300 transition-colors",
                  isDone
                    ? "border-neutral-200 opacity-60"
                    : isTaken
                    ? "border-neutral-200 opacity-75"
                    : "border-orange-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-neutral-900 text-lg">
                    {l.grade} · {t("{cubes} куб", { cubes: l.cubes })}
                  </span>
                  {isDone ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3" /> {t("Выполнен")}
                    </span>
                  ) : isTaken ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-neutral-200 text-neutral-600">
                      {t("Занято")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-700">
                      <Flame className="w-3 h-3" /> {t("Горит")}
                    </span>
                  )}
                </div>
                {!isTaken && !isDone && l.expires_at && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold">
                    <Timer className="w-3.5 h-3.5" />
                    {t("Осталось: {time}", { time: formatRemaining(new Date(l.expires_at).getTime() - now) })}
                  </div>
                )}
                <div className="flex items-start gap-2 text-sm text-neutral-600">
                  <MapPin className="w-4 h-4 mt-0.5 text-neutral-400" />
                  {l.direction}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-orange-600">
                    {l.price?.toLocaleString(locale())} ₸
                  </span>
                  <span className="text-xs text-neutral-400">{t("цена со скидкой")}</span>
                </div>

                {isDone ? null : isTaken ? (
                  isMyIntercept ? (
                    <a
                      href={`tel:${l.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2.5"
                    >
                      <Phone className="w-4 h-4" />
                      {t("Позвонить водителю: {phone}", { phone: l.phone })}
                    </a>
                  ) : (
                    <div className="text-xs font-semibold text-neutral-400 text-center py-2">
                      {t("Этот остаток уже перехватил другой прораб")}
                    </div>
                  )
                ) : isRevealed ? (
                  <a
                    href={`tel:${l.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2.5"
                  >
                    <Phone className="w-4 h-4" />
                    {t("Позвонить водителю: {phone}", { phone: l.phone })}
                  </a>
                ) : (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      intercept(l);
                    }}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-11 rounded-xl inline-flex items-center justify-center gap-1"
                  >
                    <Truck className="w-4 h-4" />
                    {t("Перехватить остаток")}
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
