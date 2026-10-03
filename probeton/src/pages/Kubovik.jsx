import React, { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
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
  Loader2,
  Package,
  CheckCircle2,
  Plus,
  Flame,
  Timer,
  Phone,
  ChevronRight,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "@/components/Skeleton";
import { useWallet, publishLeftover, formatTenge } from "@/lib/balance";
import {
  isLeftoverLive,
  findActiveDeal,
  getCurrentPosition,
  formatRemaining,
  askAdminToClose,
} from "@/lib/kubovik";
import { t, locale } from "@/lib/i18n";
import ChatButton from "@/components/ChatButton";
import LeftoverCloseRequests from "@/components/LeftoverCloseRequests";
const LazyKubovikMap = lazy(() => import("@/components/KubovikMap"));

const GRADES = ["М150", "М200", "М300", "М400"];
const DURATIONS = [
  { value: 15, label: "15 минут" },
  { value: 30, label: "30 минут" },
  { value: 45, label: "45 минут" },
  { value: 60, label: "1 час" },
  { value: 90, label: "1.5 часа" },
];

const price = (n) => `${Number(n || 0).toLocaleString(locale())} ₸`;

function Kubovik() {
  const navigate = useNavigate();
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  const isDriver = role === "driver";
  const isAdminView = role === "admin";
  const [leftovers, setLeftovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [grade, setGrade] = useState("М200");
  const [cubes, setCubes] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState("");
  const [done, setDone] = useState(false);
  const [sortBy, setSortBy] = useState("new"); // "new" | "price_asc" | "price_desc"
  const [gradeFilter, setGradeFilter] = useState("all");
  const [category, setCategory] = useState("available");
  const [driverCategory, setDriverCategory] = useState("available");
  const wallet = useWallet(isDriver ? user?.id : null);
  const postFee = user?.role === "admin" ? 0 : Number(wallet.settings?.leftover_post_fee || 0);
  const notEnoughBalance =
    isDriver && postFee > 0 && wallet.balance != null && wallet.balance < postFee;

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
    if (!cubes || priceInput === "") return;
    setSubmitting(true);
    setPostError("");
    try {
      // Где стоит миксерист — это его «горячая точка» на карте, пока он
      // не включил «на линии» (тогда точка двигается вместе с ним).
      const pos = await getCurrentPosition();
      // Публикация платная: сервер сам проверит баланс, спишет цену
      // публикации и создаст остаток (функция publish_leftover).
      const row = await publishLeftover({
        userId: user?.id,
        grade,
        cubes: parseFloat(cubes),
        direction: "",
        price: parseFloat(priceInput),
        phone: user?.phone || "",
        minutes: duration,
      });
      if (pos && row?.id) {
        await supabase
          .from("leftovers")
          .update({ post_lat: pos.lat, post_lng: pos.lng })
          .eq("id", row.id);
      }
      wallet.reload();
      load();
      setCubes("");
      setPriceInput("");
      setDone(true);
      setTimeout(() => setDone(false), 3500);
    } catch (e) {
      console.error(e);
      const msg = e?.message || "";
      setPostError(
        /publish_leftover|schema cache/i.test(msg)
          ? t("В базе ещё не выполнен файл supabase_balance.sql. Выполните его в Supabase → SQL Editor.")
          : /направление/i.test(msg)
          ? t("В базе ещё не выполнен файл supabase_v2_kubovik.sql.")
          : msg ||
              t("Не удалось опубликовать остаток. Проверьте подключение и попробуйте ещё раз.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const CATEGORIES = [
    { id: "available", label: "Новые" },
    { id: "intercepted", label: "В работе" },
    { id: "gone", label: "Выполнены" },
  ];
  const inCategory = (l, id) =>
    id === "available" ? isLeftoverLive(l, now) : l.status === id;
  const catCount = (list, id) => list.filter((l) => inCategory(l, id)).length;
  const sortFilter = (list) =>
    list
      .filter((l) => gradeFilter === "all" || l.grade === gradeFilter)
      .sort((a, b) => {
        if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
        if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
        return new Date(b.created_date) - new Date(a.created_date);
      });
  const live = leftovers.filter((l) => isLeftoverLive(l, now));
  const mine = leftovers.filter((l) => l.driver_id === user?.id);
  const mineCategorized = mine.filter((l) => inCategory(l, driverCategory));
  const activeDeal = findActiveDeal(user, leftovers);

  const header = (subtitle) => (
    <div className="px-1">
      <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        КУБОВИК
      </h1>
      <p className="text-sm text-neutral-500">{subtitle}</p>
    </div>
  );

  const categoryTabs = (list, value, onChange) => (
    <div className="grid grid-cols-3 gap-1.5">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "rounded-xl py-2 px-0.5 text-center transition-all border",
            value === c.id
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-white text-neutral-600 border-neutral-200"
          )}
        >
          <div className="text-base font-black tabular-nums">{catCount(list, c.id)}</div>
          <div className="text-[9px] font-semibold uppercase tracking-wide leading-tight">
            {t(c.label)}
          </div>
        </button>
      ))}
    </div>
  );

  const filters = (
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
  );

  // Карточка остатка в ленте (заказчик и админ).
  const feedCard = (l) => {
    const isLive = isLeftoverLive(l, now);
    return (
      <div
        key={l.id}
        onClick={() => navigate(`/leftover/${l.id}`)}
        className={cn(
          "bg-white rounded-2xl p-4 border shadow-sm space-y-2 cursor-pointer hover:border-neutral-300 transition-colors",
          isLive ? "border-orange-200" : "border-neutral-200 opacity-75"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-black text-neutral-900 text-lg">
            {l.grade ? `${l.grade} · ` : ""}
            {t("{cubes} куб", { cubes: l.cubes })}
          </span>
          <span className="text-2xl font-black text-orange-600">{price(l.price)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          {isLive && l.expires_at ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 font-bold">
              <Timer className="w-3.5 h-3.5" />
              {t("Осталось: {time}", {
                time: formatRemaining(new Date(l.expires_at).getTime() - now),
              })}
            </span>
          ) : (
            <span className="text-neutral-500 font-semibold">
              {l.status === "gone"
                ? t("Выполнен")
                : l.status === "intercepted"
                ? t("Принят заказчиком")
                : t("Время вышло")}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 font-bold text-neutral-700">
            {l.driver_name || t("Миксерист")}
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
        {l.close_requested_at && l.status === "intercepted" && isAdminView && (
          <div className="text-xs font-bold text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
            {t("Просят завершить")}
          </div>
        )}
      </div>
    );
  };

  // ===== Миксерист =====
  if (isDriver) {
    return (
      <div className="p-4 space-y-5">
        {header(t("Слив горящих остатков с дороги — со скидкой"))}

        {done && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-700 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {t("Остаток опубликован — заказчики видят вас на карте")}
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
                {t("Адрес не нужен — заказчики увидят вас на карте")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">{t("Кубов")}</Label>
              <Input
                type="number"
                min="0.5"
                max="15"
                step="0.5"
                value={cubes}
                onChange={(e) => setCubes(e.target.value)}
                placeholder={t("напр. 3")}
                className="h-12 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">{t("Цена, ₸")}</Label>
              <Input
                type="number"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder={t("напр. 20000")}
                className="h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">{t("Марка бетона")}</Label>
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
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                {t("Актуально")}
              </Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
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
            </div>
          </div>
          <p className="text-xs text-neutral-400 -mt-2">
            {t("По истечении этого времени остаток исчезнет с карты")}
          </p>

          <div
            className={cn(
              "rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-2",
              notEnoughBalance
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-neutral-50 border-neutral-200 text-neutral-600"
            )}
          >
            <span>
              {postFee > 0 ? (
                <>
                  {t("Публикация")} — <b>{formatTenge(postFee)}</b> · {t("на балансе")}{" "}
                  <b>{wallet.balance == null ? "…" : formatTenge(wallet.balance)}</b>
                </>
              ) : (
                t("Публикация сейчас бесплатная")
              )}
            </span>
            <Link to="/balance" className="font-bold underline shrink-0">
              {t("Пополнить")}
            </Link>
          </div>

          {postError && (
            <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {postError}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || notEnoughBalance}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("Публикуем...")}
              </>
            ) : postFee > 0 ? (
              `${t("Опубликовать за")} ${formatTenge(postFee)}`
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
            {categoryTabs(mine, driverCategory, setDriverCategory)}
            {mineCategorized.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-sm">
                {t("В этой категории пока пусто")}
              </div>
            ) : (
              mineCategorized.map((l) => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/leftover/${l.id}`)}
                  className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm cursor-pointer hover:border-neutral-300 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900">
                      {l.grade ? `${l.grade} · ` : ""}
                      {t("{cubes} куб", { cubes: l.cubes })}
                    </span>
                    <span className="text-sm font-black text-orange-600">{price(l.price)}</span>
                  </div>
                  {isLeftoverLive(l, now) && l.expires_at && (
                    <div className="text-xs text-neutral-500 flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" />
                      {t("На карте ещё: {time}", {
                        time: formatRemaining(new Date(l.expires_at).getTime() - now),
                      })}
                    </div>
                  )}
                  {l.status === "intercepted" && (
                    <>
                      <div className="text-sm font-semibold text-green-700">
                        {t("Заказчик принял ваш остаток")}
                      </div>
                      {l.intercepted_by_phone && (
                        <a
                          href={`tel:${l.intercepted_by_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 rounded-lg px-3 py-2"
                        >
                          <Phone className="w-4 h-4" />
                          {l.intercepted_by_phone}
                        </a>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <ChatButton
                          kind="leftover"
                          id={l.id}
                          item={l}
                          role="driver"
                          label={t("Написать заказчику")}
                        />
                      </div>
                      {l.close_requested_at ? (
                        <div className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                          {t("Запрос на завершение отправлен админу")}
                        </div>
                      ) : (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (await askAdminToClose(l, "driver")) load();
                          }}
                          className="w-full text-xs font-bold py-2 rounded-lg bg-neutral-900 text-white inline-flex items-center justify-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {t("Попросить админа завершить")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ===== Админ =====
  if (isAdminView) {
    const all = sortFilter(leftovers.filter((l) => inCategory(l, category)));
    return (
      <div className="p-4 space-y-5">
        {header(t("Все остатки миксеристов и сделки по ним"))}
        <LeftoverCloseRequests />
        {categoryTabs(leftovers, category, setCategory)}
        {filters}
        {loading ? (
          <ListSkeleton />
        ) : all.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t("В этой категории пока пусто")}</p>
          </div>
        ) : (
          <div className="space-y-3">{all.map(feedCard)}</div>
        )}
      </div>
    );
  }

  // ===== Заказчик =====
  const feed = sortFilter(live);
  return (
    <div className="p-4 space-y-4">
      {header(t("Горящие остатки бетона со скидкой — выберите миксериста на карте или в списке"))}

      {activeDeal && (
        <div
          onClick={() => navigate(`/leftover/${activeDeal.id}`)}
          className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">
              {t("Ваша сделка")}
            </span>
            <ChevronRight className="w-4 h-4 text-orange-700" />
          </div>
          <div className="font-black text-neutral-900">
            {activeDeal.grade ? `${activeDeal.grade} · ` : ""}
            {t("{cubes} куб", { cubes: activeDeal.cubes })} · {price(activeDeal.price)}
          </div>
          <div className="text-sm text-neutral-700">
            {t("Миксерист:")} <b>{activeDeal.driver_name || t("Миксерист")}</b>
          </div>
          {activeDeal.phone && (
            <a
              href={`tel:${activeDeal.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-white rounded-lg px-3 py-2"
            >
              <Phone className="w-4 h-4" />
              {activeDeal.phone}
            </a>
          )}
          <p className="text-xs text-neutral-500">
            {t("Чтобы взять другой остаток, админ должен завершить эту сделку.")}
          </p>
        </div>
      )}

      <Suspense fallback={<div className="h-[38vh] rounded-2xl bg-neutral-100 animate-pulse" />}>
        <LazyKubovikMap
          leftovers={live}
          onSelect={(l) => navigate(`/leftover/${l.id}`)}
        />
      </Suspense>

      {filters}

      {loading ? (
        <ListSkeleton />
      ) : feed.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("Сейчас свободных остатков нет")}</p>
        </div>
      ) : (
        <div className="space-y-3">{feed.map(feedCard)}</div>
      )}
    </div>
  );
}

// У насосника АБН Кубовика нет — даже по прямой ссылке.
export default function KubovikPage() {
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  if (role === "pump") return <Navigate to="/" replace />;
  return <Kubovik />;
}
