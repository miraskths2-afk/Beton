import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  Loader2,
  Flame,
  CheckCircle2,
  Trash2,
  Timer,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailPageSkeleton } from "@/components/Skeleton";
import { t, locale } from "@/lib/i18n";
import ChatButton from "@/components/ChatButton";
import { getChatRole } from "@/lib/chat";
import {
  isLeftoverLive,
  isMyLeftoverDeal,
  findActiveDeal,
  acceptLeftover,
  resolveLeftoverClose,
  formatRemaining,
  askAdminToClose,
} from "@/lib/kubovik";

const StaticPointMap = lazy(() => import("@/components/StaticPointMap"));
const OrderRouteMap = lazy(() => import("@/components/OrderRouteMap"));
const KubovikMap = lazy(() => import("@/components/KubovikMap"));

export default function LeftoverDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, viewMode } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  const [item, setItem] = useState(null);
  const [activeDeal, setActiveDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    try {
      const l = await base44.entities.Leftover.get(id);
      if (!l) setNotFound(true);
      else setItem(l);
      if (role === "client") {
        const { data } = await supabase
          .from("leftovers")
          .select("*")
          .eq("status", "intercepted");
        setActiveDeal(findActiveDeal(user, data || []) || null);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Leftover.subscribe(() => load());
    return unsub;
  }, [id, role]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const isRealAdmin = user?.role === "admin";
  const isAdminView = isRealAdmin && role === "admin";
  const isMixer = !!item && !!user && item.driver_id === user.id;
  const isMyDeal = isMyLeftoverDeal(user, item);
  const chatRole = getChatRole(user, "leftover", item, viewMode);

  const accept = async () => {
    setBusy(true);
    try {
      await acceptLeftover(user.id, item.id);
      await load();
    } catch (err) {
      console.error(err);
      alert(err?.message || t("Не удалось принять остаток. Попробуйте ещё раз."));
      load();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const extra = {};
      if (status === "intercepted" && !item.intercepted_at)
        extra.intercepted_at = new Date().toISOString();
      if (status === "gone") extra.completed_at = new Date().toISOString();
      await base44.entities.Leftover.update(id, { status, ...extra });
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const resolveClose = async (complete) => {
    setBusy(true);
    try {
      await resolveLeftoverClose(id, complete);
      await load();
    } catch (err) {
      console.error(err);
      alert(t("Не удалось сохранить. Попробуйте ещё раз."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(t("Удалить этот остаток безвозвратно?"))) return;
    setBusy(true);
    try {
      await base44.entities.Leftover.delete(id);
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert(t("Не удалось удалить остаток. Попробуйте ещё раз."));
      setBusy(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (notFound || !item) {
    return (
      <div className="p-6 text-center text-neutral-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{t("Остаток не найден (возможно, уже удалён)")}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-bold text-neutral-900 underline"
        >
          {t("Назад")}
        </button>
      </div>
    );
  }

  const l = item;
  const live = isLeftoverLive(l, now);
  // Посторонним заказчикам чужую сделку не показываем.
  if (role === "client" && !live && !isMyDeal && !isRealAdmin) {
    return (
      <div className="p-6 text-center text-neutral-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{t("Этот остаток уже приняли или его время вышло")}</p>
        <button
          onClick={() => navigate("/kubovik")}
          className="mt-4 text-sm font-bold text-neutral-900 underline"
        >
          {t("К остаткам")}
        </button>
      </div>
    );
  }

  const hasInterceptPoint = l.intercepted_lat != null && l.intercepted_lng != null;
  // Номера: после принятия миксерист и заказчик видят друг друга.
  const showMixerPhone = isRealAdmin || (isMyDeal && l.status !== "available");
  const showClientPhone = isRealAdmin || (isMixer && !!l.intercepted_by_phone);
  const canAsk = (isMixer || isMyDeal) && l.status === "intercepted";
  const myAskRole = isMixer ? "driver" : "client";

  const badge =
    l.status === "gone"
      ? { label: t("Завершён"), cls: "bg-green-100 text-green-700" }
      : l.status === "intercepted"
      ? { label: t("Принят"), cls: "bg-amber-100 text-amber-700" }
      : live
      ? { label: t("Горит"), cls: "bg-orange-100 text-orange-700" }
      : { label: t("Время вышло"), cls: "bg-neutral-200 text-neutral-500" };

  const fmtDate = (d) =>
    new Date(d).toLocaleString(locale(), {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("Назад")}
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          {l.grade ? `${l.grade} · ` : ""}
          {t("{cubes} куб", { cubes: l.cubes })}
        </h1>
        <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold", badge.cls)}>
          {badge.label}
        </span>
      </div>

      {live && (
        <Suspense fallback={<div className="h-[32vh] rounded-2xl bg-neutral-100 animate-pulse" />}>
          <KubovikMap leftovers={[l]} height="32vh" />
        </Suspense>
      )}

      {hasInterceptPoint && l.status === "intercepted" && (isMixer || isMyDeal || isRealAdmin) && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide px-1">
            {t("Миксерист и место заказчика")}
          </div>
          <Suspense
            fallback={<div className="h-[40vh] rounded-2xl bg-neutral-100 animate-pulse" />}
          >
            <OrderRouteMap
              driverId={l.driver_id}
              destination={{ lat: l.intercepted_lat, lng: l.intercepted_lng }}
              height="40vh"
            />
          </Suspense>
          {isMixer && (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${l.intercepted_lat},${l.intercepted_lng}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
              >
                Google Maps
              </a>
              <a
                href={`https://2gis.kz/directions/points/%7C${l.intercepted_lng},${l.intercepted_lat}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-700"
              >
                2ГИС
              </a>
            </div>
          )}
        </div>
      )}

      {hasInterceptPoint && l.status === "gone" && isRealAdmin && (
        <Suspense fallback={<div className="h-[28vh] rounded-2xl bg-neutral-100 animate-pulse" />}>
          <StaticPointMap
            lat={l.intercepted_lat}
            lng={l.intercepted_lng}
            label={l.intercepted_by_phone}
            height="28vh"
          />
        </Suspense>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-2xl font-black text-orange-600">
            {Number(l.price || 0).toLocaleString(locale())} ₸
          </div>
          {live && l.expires_at && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold">
              <Timer className="w-3.5 h-3.5" />
              {formatRemaining(new Date(l.expires_at).getTime() - now)}
            </span>
          )}
        </div>
        <div className="text-sm text-neutral-600">
          {t("Миксерист:")} <span className="font-semibold">{l.driver_name || t("Миксерист")}</span>
        </div>
        {l.direction && (
          <div className="flex items-start gap-2 text-sm text-neutral-600">
            <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            {l.direction}
          </div>
        )}

        {showMixerPhone && l.phone && (
          <a
            href={`tel:${l.phone}`}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2"
          >
            <Phone className="w-4 h-4" />
            {isRealAdmin ? t("Миксерист: {phone}", { phone: l.phone }) : l.phone}
          </a>
        )}
        {showClientPhone && l.intercepted_by_phone && (
          <a
            href={`tel:${l.intercepted_by_phone}`}
            className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 rounded-lg px-3 py-2"
          >
            <Phone className="w-4 h-4" />
            {t("Заказчик: {phone}", { phone: l.intercepted_by_phone })}
          </a>
        )}

        {l.intercepted_by_phone && chatRole && (
          <ChatButton
            kind="leftover"
            id={l.id}
            item={l}
            role={chatRole}
            label={
              chatRole === "admin"
                ? t("Переписка миксериста и заказчика")
                : chatRole === "driver"
                ? t("Написать заказчику")
                : t("Написать миксеристу")
            }
          />
        )}

        {role === "client" && live && !isMixer && (
          activeDeal ? (
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t("У вас уже есть сделка в Кубовике. Новую можно взять после того, как админ завершит текущую.")}
            </div>
          ) : (
            <button
              onClick={accept}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t("Принять остаток")}
            </button>
          )
        )}
        {role === "client" && live && !activeDeal && (
          <p className="text-xs text-neutral-400 text-center">
            {t("После принятия вы и миксерист увидите номера друг друга")}
          </p>
        )}

        {canAsk &&
          (l.close_requested_at ? (
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              {t("Запрос на завершение отправлен админу")}
            </div>
          ) : (
            <button
              onClick={async () => {
                if (await askAdminToClose(l, myAskRole)) load();
              }}
              className="w-full text-sm font-bold py-2.5 rounded-lg bg-neutral-900 text-white inline-flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              {t("Попросить админа завершить")}
            </button>
          ))}
        {canAsk && (
          <p className="text-xs text-neutral-400">
            {t("Завершить сделку может только админ. Напишите ему, когда остаток забрали.")}
          </p>
        )}
      </div>

      {(isRealAdmin || isMixer || isMyDeal) && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
            {t("История действий")}
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 mt-1 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-neutral-800">{t("Остаток опубликован")}</div>
                <div className="text-xs text-neutral-400">{fmtDate(l.created_date)}</div>
              </div>
            </div>
            {l.intercepted_at && (
              <div className="flex gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-neutral-800">{t("Принят заказчиком")}</div>
                  <div className="text-xs text-neutral-400">{fmtDate(l.intercepted_at)}</div>
                </div>
              </div>
            )}
            {l.close_requested_at && l.status === "intercepted" && (
              <div className="flex gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-1 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-neutral-800">
                    {l.close_requested_by === "client"
                      ? t("Заказчик просит завершить")
                      : t("Миксерист просит завершить")}
                  </div>
                  {l.close_request_note && (
                    <div className="text-xs text-neutral-600">{l.close_request_note}</div>
                  )}
                  <div className="text-xs text-neutral-400">{fmtDate(l.close_requested_at)}</div>
                </div>
              </div>
            )}
            {l.completed_at && (
              <div className="flex gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-600 mt-1 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-neutral-800">{t("Сделка завершена")}</div>
                  <div className="text-xs text-neutral-400">{fmtDate(l.completed_at)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAdminView && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">
            {t("Управление")}
          </div>
          {l.close_requested_at && l.status === "intercepted" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => resolveClose(false)}
                disabled={busy}
                className="text-xs font-bold py-2.5 rounded-lg bg-neutral-100 text-neutral-800 disabled:opacity-40"
              >
                {t("Отклонить запрос")}
              </button>
              <button
                onClick={() => resolveClose(true)}
                disabled={busy}
                className="text-xs font-bold py-2.5 rounded-lg bg-green-600 text-white disabled:opacity-40"
              >
                {t("Завершить сделку")}
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setStatus("available")}
              disabled={busy || l.status === "available"}
              className="text-xs font-bold py-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              {t("Новый")}
            </button>
            <button
              onClick={() => setStatus("intercepted")}
              disabled={busy || l.status === "intercepted"}
              className="text-xs font-bold py-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40"
            >
              {t("В работе")}
            </button>
            <button
              onClick={() => resolveClose(true)}
              disabled={busy || l.status === "gone"}
              className="text-xs font-bold py-2.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40"
            >
              {t("Выполнен")}
            </button>
          </div>
          <button
            onClick={remove}
            disabled={busy}
            className="w-full text-xs font-bold py-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {t("Удалить остаток")}
          </button>
        </div>
      )}
    </div>
  );
}
