import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Loader2,
  CheckCircle2,
  Clock,
  Truck,
  Droplets,
  Camera,
  X,
  FileText,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isBlacklisted } from "@/lib/blacklist";
import { useAuth } from "@/lib/AuthContext";
import VoiceInputButton, { appendSpoken } from "@/components/VoiceInputButton";
import { t } from "@/lib/i18n";
import {
  MIXER_CAPACITY,
  UNLOAD_METHODS,
  UNLOAD_HINTS,
  trucksEstimate,
  trucksText,
  uploadSitePhoto,
  orderDetailsErrorText,
} from "@/lib/orderExtras";

import PumpFields from "@/components/PumpFields";
import { fetchSettings } from "@/lib/balance";
import { createPumpOrder, pumpErrorText, pumpRateFor, PUMP_MIN_HOURS } from "@/lib/pump";

const LocationPicker = lazy(() => import("@/components/LocationPicker"));

const GRADES = ["М150", "М200", "М300", "М400"];

export default function QuickOrderForm({ prefill }) {
  const { user } = useAuth();
  const [grade, setGrade] = useState(prefill?.grade || "М200");
  const [cubes, setCubes] = useState(prefill?.cubes ? String(prefill.cubes) : "");
  const [address, setAddress] = useState(prefill?.delivery_address || "");
  const [location, setLocation] = useState(
    prefill?.delivery_lat != null && prefill?.delivery_lng != null
      ? { lat: prefill.delivery_lat, lng: prefill.delivery_lng }
      : null
  );
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState(prefill?.phone || "");
  // Как выгружают бетон: "slide" (слив на землю) | "pump" (в насос).
  const [unloadMethod, setUnloadMethod] = useState(prefill?.unload_method || "");
  // Лоток при сливе: "yes" | "no" | "" (ещё не выбрано).
  const [chute, setChute] = useState(
    prefill?.unload_method === "slide" ? (prefill?.chute_needed ? "yes" : "no") : ""
  );
  const [chuteMeters, setChuteMeters] = useState(
    prefill?.chute_meters ? String(prefill.chute_meters) : ""
  );
  const [mayReorder, setMayReorder] = useState(false);
  const [withDocuments, setWithDocuments] = useState(!!prefill?.with_documents);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [accessConfirmed, setAccessConfirmed] = useState(false);
  const photoInputRef = useRef(null);
  // Дозаказ к уже выполненной заявке (кнопка «Дозаказать»).
  const reorderOf = prefill?.reorderOf || null;
  // АБН вместе с бетоном (если выгрузка — автобетононасосом).
  const [withPump, setWithPump] = useState(true);
  const [pumpBoom, setPumpBoom] = useState(null);
  const [pumpHours, setPumpHours] = useState(String(PUMP_MIN_HOURS));
  const [settings, setSettings] = useState(null);
  const [timing, setTiming] = useState("asap"); // "asap" | "scheduled"
  const [neededBy, setNeededBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (unloadMethod !== "pump" || settings) return;
    fetchSettings().then(setSettings).catch((e) => console.error(e));
  }, [unloadMethod, settings]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const trucks = trucksEstimate(cubes);
  const unloadValid =
    unloadMethod === "slide"
      ? chute === "no" || (chute === "yes" && Number(chuteMeters) > 0)
      : !!UNLOAD_METHODS[unloadMethod];
  const accessValid = !!photoFile || accessConfirmed;
  const orderPump = unloadMethod === "pump" && withPump;
  const pumpValid = !orderPump || !!pumpBoom;

  const isValid =
    cubes &&
    Number(cubes) > 0 &&
    address.trim() &&
    phone.trim() &&
    !!location &&
    unloadValid &&
    accessValid &&
    pumpValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    if (timing === "scheduled" && !neededBy) return;
    // Проверяем и номер в заявке, и номер аккаунта заказчика — иначе из
    // чёрного списка можно было бы выйти, просто вписав другой номер.
    const ownPhone = user?.role !== "admin" ? user?.phone : null;
    if (
      (await isBlacklisted(phone.trim())) ||
      (ownPhone && (await isBlacklisted(ownPhone)))
    ) {
      alert(t("Этот номер в чёрном списке PROBETON. Заказ недоступен. Чтобы выйти из списка, свяжитесь с диспетчером и оплатите штраф."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const sitePhotoUrl = photoFile ? await uploadSitePhoto(photoFile) : null;
      const cubesNum = parseFloat(cubes);
      const pricePerCube = prefill?.price_per_cube ?? null;
      const created = await base44.entities.Order.create({
        order_number: "PB-" + Date.now().toString().slice(-6),
        what_needed: `${cubes} м³ бетона ${grade}, адрес: ${address.trim()}`,
        grade,
        cubes: cubesNum,
        delivery_address: address.trim(),
        delivery_lat: location?.lat ?? null,
        delivery_lng: location?.lng ?? null,
        comment: comment.trim() || null,
        phone: phone.trim(),
        order_type: prefill?.order_type === "calculator" ? "calculator" : "quick",
        price_per_cube: pricePerCube,
        total: pricePerCube != null ? pricePerCube * cubesNum : null,
        unload_method: unloadMethod,
        chute_needed: unloadMethod === "slide" && chute === "yes",
        chute_meters:
          unloadMethod === "slide" && chute === "yes" ? parseFloat(chuteMeters) : null,
        may_reorder: mayReorder,
        reorder_of: reorderOf?.id || null,
        with_documents: withDocuments,
        site_photo_url: sitePhotoUrl,
        access_confirmed: !sitePhotoUrl && accessConfirmed,
        status: "new",
        needed_by:
          timing === "scheduled" ? new Date(neededBy).toISOString() : null,
      });
      // АБН к этой заявке — отдельная заявка для насосников.
      if (orderPump) {
        try {
          await createPumpOrder({
            boom: pumpBoom,
            hours: pumpHours,
            rate: pumpRateFor(settings, pumpBoom),
            address: address.trim(),
            lat: location?.lat,
            lng: location?.lng,
            phone: phone.trim(),
            comment: comment.trim(),
            neededBy: timing === "scheduled" ? new Date(neededBy).toISOString() : null,
            linkedOrder: created,
          });
        } catch (pumpErr) {
          console.error(pumpErr);
          alert(
            t("Заявка на бетон принята, но АБН заказать не получилось: {error}", {
              error: pumpErrorText(pumpErr),
            })
          );
        }
      }
      setSuccess(true);
      setPumpBoom(null);
      setPumpHours(String(PUMP_MIN_HOURS));
      setWithPump(true);
      setGrade("М200");
      setCubes("");
      setAddress("");
      setLocation(null);
      setComment("");
      setPhone("");
      setTiming("asap");
      setNeededBy("");
      setUnloadMethod("");
      setChute("");
      setChuteMeters("");
      setMayReorder(false);
      setWithDocuments(false);
      setPhotoFile(null);
      setAccessConfirmed(false);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      setError(
        err?.message
          ? orderDetailsErrorText(err)
          : t("Не удалось сохранить заявку. Проверьте подключение и попробуйте ещё раз.")
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center border border-neutral-200 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="font-bold text-lg text-neutral-900">{t("Заявка принята!")}</h3>
        <p className="text-sm text-neutral-500 mt-1">
          {t("Наш менеджер свяжется с вами в ближайшее время.")}
        </p>
      </div>
    );
  }

  // Минимальное допустимое время в поле "выбрать время" — через 30 минут от сейчас.
  const minDateTime = new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16);

  const choiceCls = (active) =>
    cn(
      "h-11 rounded-xl text-sm font-semibold border transition-colors px-2",
      active
        ? "bg-neutral-900 text-white border-neutral-900"
        : "bg-white text-neutral-600 border-neutral-200"
    );

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900">{t("Заказ в один клик")}</h2>
          <p className="text-xs text-neutral-500">
            {t("Заполните поля — мы перезвоним")}
          </p>
        </div>
      </div>

      {reorderOf && (
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Repeat className="w-4 h-4 shrink-0" />
          {t("Дозаказ к заявке {number}", { number: reorderOf.number || "" })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-neutral-700">
            {t("Марка бетона")}
          </Label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="h-11 rounded-xl">
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
          <Label htmlFor="cubes" className="text-sm font-semibold text-neutral-700">
            {t("Кубов")}
          </Label>
          <Input
            id="cubes"
            type="number"
            min="0.5"
            step="0.5"
            value={cubes}
            onChange={(e) => setCubes(e.target.value)}
            placeholder={t("Напр. 5")}
            className="h-11"
            required
          />
        </div>
      </div>

      {trucks > 0 && (
        <div className="flex items-start gap-2 text-xs text-neutral-700 bg-neutral-100 rounded-lg px-3 py-2">
          <Truck className="w-4 h-4 shrink-0 text-neutral-500" />
          <span>
            {t("Понадобится примерно {trucks}", { trucks: trucksText(trucks) })}{" "}
            <span className="text-neutral-400">
              {t("(примерно, в среднем ~{cap} м³ в одном миксере)", { cap: MIXER_CAPACITY })}
            </span>
          </span>
        </div>
      )}

      <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={mayReorder}
          onChange={(e) => setMayReorder(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-neutral-900"
        />
        <span className="text-sm text-neutral-800">
          <span className="font-semibold">{t("Возможен дозаказ")}</span>
          <span className="block text-xs text-neutral-500">
            {t("Не уверен, что этого объёма хватит — после выполнения могу заказать ещё")}
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5" />
          {t("Как будет выгружаться бетон")} <span className="text-red-500">*</span>
        </Label>
        {/* Выпадающий список вместо кнопок — форма не раздувается. */}
        <Select value={unloadMethod} onValueChange={setUnloadMethod}>
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue placeholder={t("Выберите способ")} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(UNLOAD_METHODS).map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {t(label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {unloadMethod && UNLOAD_HINTS[unloadMethod] && (
          <p className="text-xs text-neutral-500 px-1">{t(UNLOAD_HINTS[unloadMethod])}</p>
        )}
        {unloadMethod === "pump" && (
          <div className="space-y-3 rounded-xl bg-sky-50/50 border border-sky-200 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={withPump}
                onChange={(e) => setWithPump(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-sky-600"
              />
              <span className="text-sm text-neutral-800">
                <span className="font-semibold">{t("Заказать АБН здесь же")}</span>
                <span className="block text-xs text-neutral-500">
                  {t("Насосник получит отдельную заявку. Вы будете видеть и миксериста, и насосника, и сможете писать обоим. Если заявку возьмёт завод — общаетесь только с заводом.")}
                </span>
              </span>
            </label>
            {withPump && (
              <PumpFields
                boom={pumpBoom}
                onBoom={setPumpBoom}
                hours={pumpHours}
                onHours={setPumpHours}
                settings={settings}
              />
            )}
          </div>
        )}
        {unloadMethod === "slide" && (
          <div className="space-y-2 rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <div className="text-xs font-semibold text-neutral-700">
              {t("Нужен лоток (удлинитель), чтобы дотянуть бетон до дальних мест?")}{" "}
              <span className="text-red-500">*</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setChute("yes")} className={choiceCls(chute === "yes")}>
                {t("Да, нужен")}
              </button>
              <button type="button" onClick={() => setChute("no")} className={choiceCls(chute === "no")}>
                {t("Не нужен")}
              </button>
            </div>
            {chute === "yes" && (
              <div className="space-y-1">
                <Label htmlFor="chuteMeters" className="text-xs font-semibold text-neutral-600">
                  {t("Примерно сколько метров лотка")}
                </Label>
                <Input
                  id="chuteMeters"
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  value={chuteMeters}
                  onChange={(e) => setChuteMeters(e.target.value)}
                  placeholder={t("Напр. 4")}
                  className="h-11"
                  required
                />
              </div>
            )}
          </div>
        )}
      </div>

      <label
        className={cn(
          "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer",
          withDocuments ? "border-indigo-300 bg-indigo-50" : "border-neutral-200"
        )}
      >
        <input
          type="checkbox"
          checked={withDocuments}
          onChange={(e) => setWithDocuments(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-indigo-600"
        />
        <span className="text-sm text-neutral-800">
          <span className="font-semibold inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            {t("Бетон с документами")}
          </span>
          <span className="block text-xs text-neutral-500">
            {t("Официальный договор и документы на бетон. Выполняют только заводы: цена выше, качество надёжное.")}
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-semibold text-neutral-700">
          {t("Адрес / место доставки")}
        </Label>
        <div className="flex gap-2">
          <Input
            id="address"
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
        <Label className="text-sm font-semibold text-neutral-700">
          {t("Место объекта на карте")}
        </Label>
        <Suspense
          fallback={
            <div className="h-[35vh] rounded-xl bg-neutral-100 animate-pulse" />
          }
        >
          <LocationPicker
            value={location}
            onChange={setLocation}
            onAddress={setAddress}
          />
        </Suspense>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment" className="text-sm font-semibold text-neutral-700">
          {t("Дополнительные комментарии")}
        </Label>
        <div className="flex gap-2 items-start">
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("Необязательно: подъезд, ориентир, пожелания к подаче...")}
            rows={2}
            className="resize-none"
          />
          <VoiceInputButton
            onText={(txt) => setComment((prev) => appendSpoken(prev, txt))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" />
          {t("Фото заезда на объект")}
        </Label>
        <p className="text-xs text-neutral-500">
          {t("Сфотографируйте въезд, чтобы миксерист заранее знал, что проедет. Если заезд затруднён — клиент обязан обеспечить проходимый заезд для миксера.")}
        </p>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPhotoFile(f);
            e.target.value = "";
          }}
        />
        {photoPreview ? (
          <div className="relative">
            <img
              src={photoPreview}
              alt=""
              className="w-full max-h-56 object-cover rounded-xl border border-neutral-200"
            />
            <button
              type="button"
              onClick={() => setPhotoFile(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label={t("Убрать фото")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full h-11 rounded-xl border border-dashed border-neutral-300 text-sm font-semibold text-neutral-600 inline-flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              {t("Добавить фото заезда")}
            </button>
            <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={accessConfirmed}
                onChange={(e) => setAccessConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-neutral-900"
              />
              <span className="text-xs text-neutral-700">
                {t("Без фото: я уверен, что миксер проедет. Если заезд окажется затруднён — обеспечу проходимый заезд.")}
              </span>
            </label>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-semibold text-neutral-700">
          {t("Номер телефона клиента")}
        </Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          className="h-11"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {t("Когда нужен бетон")}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTiming("asap")}
            className={`h-11 rounded-xl text-sm font-semibold border transition-colors ${
              timing === "asap"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200"
            }`}
          >
            {t("Как можно скорее")}
          </button>
          <button
            type="button"
            onClick={() => setTiming("scheduled")}
            className={`h-11 rounded-xl text-sm font-semibold border transition-colors ${
              timing === "scheduled"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200"
            }`}
          >
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

      {Number(cubes) > 0 && (!unloadValid || !accessValid || !pumpValid) && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-0.5">
          {!unloadValid && <div>• {t("Укажите, как будет выгружаться бетон (и нужен ли лоток)")}</div>}
          {!pumpValid && <div>• {t("Выберите длину стрелы АБН")}</div>}
          {!accessValid && <div>• {t("Добавьте фото заезда или отметьте, что заезд свободный")}</div>}
        </div>
      )}

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !isValid || (timing === "scheduled" && !neededBy)}
        className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold h-12 rounded-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t("Отправка...")}
          </>
        ) : (
          t("Заказать бетон")
        )}
      </Button>
    </form>
  );
}
