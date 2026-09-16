import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle, Loader2, FileCheck2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import TermsContent from "@/components/TermsContent";
import MixerIcon from "@/components/MixerIcon";

// Показывается один раз новому пользователю (или когда меняется версия
// соглашения). Сначала просим имя, если его ещё нет, затем — согласие
// с офертой. После обоих шагов пускаем в приложение.
export default function Onboarding() {
  const { user, checkUserAuth } = useAuth();
  const navigate = useNavigate();

  const needsName = !user?.full_name;
  const needsTerms =
    !user?.terms_accepted || user?.terms_version !== CURRENT_TERMS_VERSION;

  const [step, setStep] = useState(needsName ? "name" : "terms");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finishIfDone = () => {
    navigate("/", { replace: true });
  };

  const submitName = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Введите имя, минимум 2 буквы");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await base44.auth.updateMe({ full_name: name.trim() });
      await checkUserAuth();
      if (needsTerms) {
        setStep("terms");
      } else {
        finishIfDone();
      }
    } catch (err) {
      console.error(err);
      setError("Не удалось сохранить имя, попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  };

  const submitTerms = async () => {
    setBusy(true);
    setError("");
    try {
      await base44.auth.updateMe({
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
      });
      await checkUserAuth();
      finishIfDone();
    } catch (err) {
      console.error(err);
      setError("Не удалось сохранить согласие, попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center px-5 py-8">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center text-neutral-900">
            <MixerIcon className="w-5 h-5" />
          </div>
          <div className="font-black text-lg tracking-tight text-neutral-900">
            Кубовик
          </div>
        </div>

        {step === "name" && (
          <form
            onSubmit={submitName}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-900">
                Как вас зовут?
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Так к вам будут обращаться в приложении
              </p>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Мирас"
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-800"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-neutral-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Продолжить"}
            </button>
          </form>
        )}

        {step === "terms" && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <FileCheck2 className="w-6 h-6 text-amber-600" />
            </div>
            <h1 className="text-xl font-black text-neutral-900">
              Пользовательское соглашение
            </h1>
            <div className="max-h-[45vh] overflow-y-auto pr-1 text-sm border border-neutral-100 rounded-xl p-3 bg-neutral-50">
              <TermsContent />
            </div>
            <label className="flex items-start gap-2.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4"
              />
              Я принимаю Пользовательское соглашение
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={submitTerms}
              disabled={!agreed || busy}
              className="w-full py-2.5 rounded-lg bg-neutral-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Принять и продолжить"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
