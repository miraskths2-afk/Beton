import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Wrench, ChevronRight } from "lucide-react";

const ROLE_KEY = "probeton_role";

export default function RoleSelect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(ROLE_KEY)) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const choose = (role) => {
    localStorage.setItem(ROLE_KEY, role);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-neutral-900 text-white px-5 py-5 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center font-black text-neutral-900 text-sm">
          PRO
        </div>
        <div className="leading-none">
          <div className="font-black text-lg tracking-tight">PROBETON</div>
          <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">
            Доставка бетона
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center px-5 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-black text-neutral-900 text-center">
          Кто вы?
        </h1>
        <p className="text-sm text-neutral-500 text-center mt-1 mb-8">
          Выберите тип аккаунта, чтобы продолжить
        </p>

        <button
          onClick={() => choose("client")}
          className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-transform mb-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Truck className="w-7 h-7 text-amber-600" />
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-black text-neutral-900">
              Я Прораб / Заказчик
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Заказываю бетон с доставкой
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>

        <button
          onClick={() => choose("driver")}
          className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-transform"
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
            <Wrench className="w-7 h-7 text-purple-600" />
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-black text-neutral-900">
              Я Водитель / Мастер
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Доставляю бетон на своей технике
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>

        <p className="text-center text-xs text-neutral-400 mt-8">
          Уже есть аккаунт?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-neutral-700 font-semibold underline"
          >
            Войти
          </button>
        </p>
      </div>
    </div>
  );
}
