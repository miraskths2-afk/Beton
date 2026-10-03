import React, { useEffect, useState, lazy, Suspense } from "react";
import { Loader2, CheckCircle2, Clock, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/PhoneInput";
import { isPhoneComplete, phoneFull } from "@/lib/phone";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { isBlacklisted } from "@/lib/blacklist";
import { fetchSettings } from "@/lib/balance";
import { createPumpOrder, pumpErrorText, pumpRateFor, PUMP_MIN_HOURS } from "@/lib/pump";
import VoiceInputButton, { appendSpoken } from "@/components/VoiceInputButton";
import PumpFields from "@/components/PumpFields";

const LocationPicker = lazy(() => import("@/components/LocationPicker"));

// Отдельный заказ автобетононасоса (вкладка «АБН» у заказчика).
// Заявку видят все насосники на линии.
export default function PumpOrderForm({ phone: initialPhone, clientId }) {
  const [settings, setSettings] = useState(null);
  const [boom, setBoom] = useState(null);
  const [hours, setHours] = useState(String(PUMP_MIN_HOURS));
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(null);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState(initialPhone || "");
  const [timing, setTiming] = useState("asap");
  const [neededBy, setNeededBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSettings().then(setSettings).catch((e) => console.error(e));
  }, []);

  const isValid =
    !!boom &&
    address.trim() &&
    !!location &&
    isPhoneComplete(phone) &&
    (timing === "asap" || !!neededBy);

  const submit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    if (await isBlacklisted(phone)) {
      alert(t("Этот номер в чёрном списке PROBETON. Заказ недоступен."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createPumpOrder({
        boom,
        hours,
        rate: pumpRateFor(settings, boom),
        address: address.trim(),
        lat: location?.lat,
        lng: location?.lng,
        phone: phoneFull(phone),
        clientId,
        comment: comment.trim(),
        neededBy: timing === "scheduled" ? new Date(neededBy).toISOString() : null,
      });
      setSuccess(true);
      setBoom(null);
      setHours(String(PUMP_MIN_HOURS));
      setAddress("");
      setLocation(null);
      setComment("");
      setTiming("asap");
      setNeededBy("");
    } catch (err) {
      console.error(err);
      setError(pumpErrorText(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center border border-neutral-200 shadow-sm space-y-3">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="font-bold text-lg text-neutral-900">{t("Заявка на АБН принята!")}</h3>
        <p className="text-sm text-neutral-500">
          {t("Как только насосник её возьмёт, во вкладке «Мой заказ» появится чат с ним.")}
        </p>
        <button onClick={() => setSuccess(false)} className="text-sm font-bold underline">
          {t("Заказать ещё один АБН")}
        </button>
      </div>
    );
  }

  const minDateTime = new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16);
  const choiceCls = (active) =>
    cn(
      "h-11 rounded-xl text-sm font-semibold border transition-colors",
      active ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-600 border-neutral-200"
    );

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
          <Construction className="w-4 h-4 text-sky-600" />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900">{t("Заказать автобетононасос (АБН)")}</h2>
          <p className="text-xs text-neutral-500">{t("Оплата почасовая, минимум 3 часа")}</p>
        </div>
      </div>

      <PumpFields boom={boom} onBoom={setBoom} hours={hours} onHours={setHours} settings={settings} />

      <div className="space-y-2">
        <Label htmlFor="pump-address" className="text-sm font-semibold text-neutral-700">
          {t("Адрес объекта")}
        </Label>
        <div className="flex gap-2">
          <Input
            id="pump-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("Напр.: Наурызбайский р-н, ул. Абая 10")}
            className="h-11"
            required
          />
          <VoiceInputButton
            className="h-11 w-11"
            onText={(txt) => setAddress((prev) => appendSpoken(prev, txt))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-neutral-700">{t("Место объекта на карте")}</Label>
        <Suspense fallback={<div className="h-[35vh] rounded-xl bg-neutral-100 animate-pulse" />}>
          <LocationPicker value={location} onChange={setLocation} onAddress={setAddress} />
        </Suspense>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {t("Когда нужен насос")}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTiming("asap")} className={choiceCls(timing === "asap")}>
            {t("Как можно скорее")}
          </button>
          <button type="button" onClick={() => setTiming("scheduled")} className={choiceCls(timing === "scheduled")}>
            {t("Выбрать время")}
          </button>
        </div>
        {timing === "scheduled" && (
          <Input
            type="datetime-local"
            value={neededBy}
            min={minDateTime}
            onChange={(e) => setNeededBy(e.target.value)}
            className="h-11"
            required
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pump-comment" className="text-sm font-semibold text-neutral-700">
          {t("Дополнительные комментарии")}
        </Label>
        <Textarea
          id="pump-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("Необязательно: этаж, куда подавать, где поставить насос...")}
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pump-phone" className="text-sm font-semibold text-neutral-700">
          {t("Номер телефона клиента")}
        </Label>
        <PhoneInput
          id="pump-phone"
          value={phone}
          onChange={setPhone}
          className="h-11"
          required
        />
      </div>

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !isValid}
        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold h-12 rounded-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t("Отправка...")}
          </>
        ) : (
          t("Заказать АБН")
        )}
      </Button>
    </form>
  );
}
