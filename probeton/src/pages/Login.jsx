// Этот файл заменяет src/pages/Login.jsx.
// Вход теперь простой: только номер телефона, без email/пароля/Google.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AuthLayout from "@/components/AuthLayout";
import MixerIcon from "@/components/MixerIcon";
import PhoneInput from "@/components/PhoneInput";
import { isPhoneComplete, phoneFull } from "@/lib/phone";
import { t } from "@/lib/i18n";

const ROLE_KEY = "probeton_role";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPhoneComplete(phone)) {
      setError(t("Введите корректный номер телефона"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const accountType = localStorage.getItem(ROLE_KEY) || "client";
      await base44.auth.loginWithPhone(phoneFull(phone), { account_type: accountType });
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setError(t("Не удалось войти. Попробуйте ещё раз."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={MixerIcon}
      title={t("Вход")}
      subtitle={t("Введите номер телефона, чтобы продолжить")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("Номер телефона")}
          </label>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            className="h-10 rounded-lg border-slate-200 shadow-none focus-visible:ring-2 focus-visible:ring-slate-800"
            required
            autoFocus
          />
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
            t("Войти")
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          localStorage.removeItem(ROLE_KEY);
          navigate("/choose-role", { replace: true });
        }}
        className="w-full mt-4 flex items-center justify-center gap-1 text-sm text-slate-500 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("Выбрать роль заново")}
      </button>
    </AuthLayout>
  );
}
