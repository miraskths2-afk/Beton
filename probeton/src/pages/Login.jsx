// Вход по номеру телефона с подтверждением SMS-кодом.
// Шаг 1 — номер, шаг 2 — код из SMS.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Loader2, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AuthLayout from "@/components/AuthLayout";
import MixerIcon from "@/components/MixerIcon";

const RESEND_SECONDS = 60;

function authErrorText(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("expired") || msg.includes("invalid"))
    return "Неверный или устаревший код. Проверьте SMS или запросите новый.";
  if (msg.includes("rate") || msg.includes("seconds"))
    return "Слишком частые попытки. Подождите минуту и попробуйте снова.";
  return "Не удалось войти. Попробуйте ещё раз.";
}

export default function Login() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone"); // "phone" | "code"
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (e) => {
    e?.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Введите корректный номер телефона");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await base44.auth.sendCode(digits);
      setStep("code");
      setCode("");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      console.error(err);
      setError(authErrorText(err));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      setError("Введите код из SMS");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await base44.auth.verifyCode(phone, code);
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setError(authErrorText(err));
    } finally {
      setLoading(false);
    }
  };

  if (step === "code") {
    return (
      <AuthLayout
        icon={MixerIcon}
        title="Код из SMS"
        subtitle={`Мы отправили код на ${phone}`}
      >
        <form onSubmit={verify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Код</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-slate-800"
                required
                autoFocus
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Войти"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError("");
              }}
              className="text-slate-500 underline"
            >
              Изменить номер
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={loading || resendIn > 0}
              className="text-slate-900 font-medium disabled:text-slate-400"
            >
              {resendIn > 0 ? `Отправить снова через ${resendIn} с` : "Отправить код снова"}
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={MixerIcon}
      title="Вход"
      subtitle="Введите номер телефона — мы пришлём код в SMS"
    >
      <form onSubmit={sendCode} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Номер телефона
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 700 000 00 00"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
              required
              autoFocus
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Получить код"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
