import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle, Loader2, FileCheck2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import TermsContent from "@/components/TermsContent";
import MixerIcon from "@/components/MixerIcon";
import { t } from "@/lib/i18n";
import { EQUIPMENT, equipmentFor, needsVehicleInfo } from "@/lib/equipment";
import { PUMP_BOOMS, boomLabel, pumpErrorText } from "@/lib/pump";

// Показывается один раз новому пользователю (или когда меняется версия
// соглашения). Сначала просим имя, если его ещё нет, затем — согласие
// с офертой. После обоих шагов пускаем в приложение.
export default function Onboarding() {
  const { user, checkUserAuth } = useAuth();
  const navigate = useNavigate();

  const needsName = !user?.full_name;
  const needsTerms =
    !user?.terms_accepted || user?.terms_version !== CURRENT_TERMS_VERSION;

  const needsVehicle = needsVehicleInfo(user);
  const [step, setStep] = useState(
    needsName ? "name" : needsVehicle ? "vehicle" : "terms"
  );
  const [plate, setPlate] = useState(user?.vehicle_plate || "");
  const isPump = user?.account_type === "pump";
  const [boom, setBoom] = useState(user?.pump_boom ? String(user.pump_boom) : "");
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
      setError(t("Введите имя, минимум 2 буквы"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await base44.auth.updateMe({ full_name: name.trim() });
      await checkUserAuth();
      if (needsVehicle) {
        setStep("vehicle");
      } else if (needsTerms) {
        setStep("terms");
      } else {
        finishIfDone();
      }
    } catch (err) {
      console.error(err);
      setError(t("Не удалось сохранить имя, попробуйте ещё раз"));
    } finally {
      setBusy(false);
    }
  };

  const submitVehicle = async (e) => {
    e.preventDefault();
    const cleanPlate = plate.trim().toUpperCase().replace(/\s+/g, " ");
    if (cleanPlate.replace(/\s/g, "").length < 5) {
      setError(t("Введите гос. номер полностью, например 123 ABC 02"));
      return;
    }
    if (isPump && !boom) {
      setError(t("Выберите длину стрелы насоса"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await base44.auth.updateMe({
        vehicle_plate: cleanPlate,
        equipment_type: equipmentFor(user),
        ...(isPump ? { pump_boom: Number(boom) } : {}),
      });
      await checkUserAuth();
      if (needsTerms) {
        setStep("terms");
      } else {
        finishIfDone();
      }
    } catch (err) {
      console.error(err);
      // Нет колонки pump_boom — значит, в базе ещё не выполнен SQL для АБН.
      setError(
        /pump_boom/.test(String(err?.message || ""))
          ? pumpErrorText(err)
          : t("Не удалось сохранить данные, попробуйте ещё раз")
      );
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
      setError(t("Не удалось сохранить согласие, попробуйте ещё раз"));
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
                {t("Как вас зовут?")}
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                {t("Так к вам будут обращаться в приложении")}
              </p>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Ваше имя")}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-800"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-neutral-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Продолжить")}
            </button>
          </form>
        )}

        {step === "vehicle" && (
          <form
            onSubmit={submitVehicle}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <MixerIcon className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-900">
                {t("Ваша техника")}
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                {t("Диспетчер проверит эти данные перед одобрением")}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-neutral-700">
                {t("Гос. номер")}
              </label>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="123 ABC 02"
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg uppercase focus:outline-none focus:ring-2 focus:ring-neutral-800"
                autoFocus
              />
            </div>
            <div className="text-sm text-neutral-700">
              {t("Вид техники")}: <span className="font-semibold">{t(EQUIPMENT[equipmentFor(user)])}</span>
            </div>
            {isPump && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">
                  {t("Длина стрелы")}
                </label>
                <select
                  value={boom}
                  onChange={(e) => setBoom(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800"
                >
                  <option value="">{t("Выберите")}</option>
                  {PUMP_BOOMS.map((b) => (
                    <option key={b} value={b}>
                      {boomLabel(b)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-neutral-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Продолжить")}
            </button>
          </form>
        )}

        {step === "terms" && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <FileCheck2 className="w-6 h-6 text-amber-600" />
            </div>
            <h1 className="text-xl font-black text-neutral-900">
              {t("Пользовательское соглашение")}
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
              {t("Я принимаю Пользовательское соглашение")}
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
                t("Принять и продолжить")
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
