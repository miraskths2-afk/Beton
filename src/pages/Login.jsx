// Этот файл заменяет src/pages/Login.jsx.
// Вход теперь простой: только номер телефона, без email/пароля/Google.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Phone, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AuthLayout from "@/components/AuthLayout";

const ROLE_KEY = "probeton_role";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Введите корректный номер телефона");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const accountType = localStorage.getItem(ROLE_KEY) || "client";
      await base44.auth.loginWithPhone(digits, { account_type: accountType });
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Не удалось войти. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Вход"
      subtitle="Введите номер телефона, чтобы продолжить"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            "Войти"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
