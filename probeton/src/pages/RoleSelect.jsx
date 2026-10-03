import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Truck, Wrench, ChevronRight, Construction, ArrowLeft, Loader2, Factory } from "lucide-react";
import MixerIcon from "@/components/MixerIcon";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { t } from "@/lib/i18n";
import { canChangeRole, roleChangeFields } from "@/lib/roleChange";

const ROLE_KEY = "probeton_role";

// Стартовый экран «Кто вы?». Открывается и повторно — по ссылке
// /choose-role?change=1 (кнопка «Выбрать роль заново» на входе,
// в регистрации, на экране ожидания и в профиле). Если человек уже
// вошёл, выбранная роль сразу записывается в его аккаунт.
export default function RoleSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const changing = searchParams.get("change") === "1";
  const { user, isAuthenticated, checkUserAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!changing && localStorage.getItem(ROLE_KEY)) {
      navigate("/login", { replace: true });
    }
  }, [navigate, changing]);

  const choose = async (role) => {
    localStorage.setItem(ROLE_KEY, role);
    if (!(changing && isAuthenticated && user)) {
      navigate("/login", { replace: true });
      return;
    }
    if (!canChangeRole(user) || user.account_type === role) {
      navigate("/", { replace: true });
      return;
    }
    setBusy(true);
    setError("");
    try {
      await base44.auth.updateMe(roleChangeFields(role));
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setError(t("Не удалось сменить роль, попробуйте ещё раз"));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-neutral-900 text-white px-5 py-5 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center text-neutral-900">
          <MixerIcon className="w-5 h-5" />
        </div>
        <div className="leading-none">
          <div className="font-black text-lg tracking-tight">PROBETON</div>
          <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">
            {t("Доставка бетона")}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center px-5 max-w-md mx-auto w-full">
        {changing && (
          <button
            onClick={() => navigate(isAuthenticated ? "/" : "/login", { replace: true })}
            className="self-start flex items-center gap-1 text-sm text-neutral-500 font-semibold mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("Назад")}
          </button>
        )}
        <h1 className="text-2xl font-black text-neutral-900 text-center">
          {t("Кто вы?")}
        </h1>
        <p className="text-sm text-neutral-500 text-center mt-1 mb-8">
          {t("Выберите тип аккаунта, чтобы продолжить")}
        </p>
        {changing && isAuthenticated && user?.approval_status === "approved" && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 -mt-4 mb-6 text-center">
            {t("Водителю, насоснику и поставщику после смены роли нужно новое одобрение диспетчера")}
          </p>
        )}
        {error && <p className="text-sm text-red-600 text-center -mt-4 mb-6">{error}</p>}
        {busy && (
          <div className="flex justify-center -mt-4 mb-6">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
          </div>
        )}

        <button
          disabled={busy}
          onClick={() => choose("client")}
          className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-transform mb-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Truck className="w-7 h-7 text-amber-600" />
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-black text-neutral-900">
              {t("Я Прораб / Заказчик")}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {t("Заказываю бетон с доставкой")}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>

        <button
          disabled={busy}
          onClick={() => choose("driver")}
          className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-transform"
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
            <Wrench className="w-7 h-7 text-purple-600" />
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-black text-neutral-900">
              {t("Я Водитель / Мастер")}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {t("Доставляю бетон на своей технике")}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>

        <button
          disabled={busy}
          onClick={() => choose("pump")}
          className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-transform mt-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center shrink-0">
            <Construction className="w-7 h-7 text-sky-600" />
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-black text-neutral-900">
              {t("Я Насосник (АБН)")}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {t("Подаю бетон автобетононасосом")}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>

        <button
          disabled={busy}
          onClick={() => choose("supplier")}
          className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-transform mt-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Factory className="w-7 h-7 text-indigo-600" />
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-black text-neutral-900">
              {t("Я Поставщик (завод)")}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {t("Продаю бетон миксеристам на своём заводе")}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>

        {!changing && (
          <p className="text-center text-xs text-neutral-400 mt-8">
            {t("Уже есть аккаунт?")}{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-neutral-700 font-semibold underline"
            >
              {t("Войти")}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
