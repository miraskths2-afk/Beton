import React, { useState, lazy, Suspense } from "react";
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
import { Zap, Loader2, CheckCircle2, Clock } from "lucide-react";
import { isBlacklisted } from "@/lib/blacklist";

const LocationPicker = lazy(() => import("@/components/LocationPicker"));

const GRADES = ["М150", "М200", "М300", "М400"];

export default function QuickOrderForm() {
  const [grade, setGrade] = useState("М200");
  const [cubes, setCubes] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(null);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [timing, setTiming] = useState("asap"); // "asap" | "scheduled"
  const [neededBy, setNeededBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isValid =
    cubes && Number(cubes) > 0 && address.trim() && phone.trim() && !!location;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    if (timing === "scheduled" && !neededBy) return;
    if (await isBlacklisted(phone.trim())) {
      alert("Этот номер в чёрном списке PROBETON. Заказ недоступен.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await base44.entities.Order.create({
        order_number: "PB-" + Date.now().toString().slice(-6),
        what_needed: `${cubes} м³ бетона ${grade}, адрес: ${address.trim()}`,
        grade,
        cubes: parseFloat(cubes),
        delivery_address: address.trim(),
        delivery_lat: location?.lat ?? null,
        delivery_lng: location?.lng ?? null,
        comment: comment.trim() || null,
        phone: phone.trim(),
        order_type: "quick",
        status: "new",
        needed_by:
          timing === "scheduled" ? new Date(neededBy).toISOString() : null,
      });
      setSuccess(true);
      setGrade("М200");
      setCubes("");
      setAddress("");
      setLocation(null);
      setComment("");
      setPhone("");
      setTiming("asap");
      setNeededBy("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "Не удалось сохранить заявку. Проверьте подключение и попробуйте ещё раз."
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
        <h3 className="font-bold text-lg text-neutral-900">Заявка принята!</h3>
        <p className="text-sm text-neutral-500 mt-1">
          Наш менеджер свяжется с вами в ближайшее время.
        </p>
      </div>
    );
  }

  // Минимальное допустимое время в поле "выбрать время" — через 30 минут от сейчас.
  const minDateTime = new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16);

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
          <h2 className="font-bold text-neutral-900">Заказ в один клик</h2>
          <p className="text-xs text-neutral-500">
            Заполните поля — мы перезвоним
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-neutral-700">
            Марка бетона
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
            Кубов
          </Label>
          <Input
            id="cubes"
            type="number"
            min="0.5"
            step="0.5"
            value={cubes}
            onChange={(e) => setCubes(e.target.value)}
            placeholder="Напр. 5"
            className="h-11"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-semibold text-neutral-700">
          Адрес / место доставки
        </Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Напр.: Наурызбайский р-н, ул. Абая 10"
          className="h-11"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-neutral-700">
          Место объекта на карте
        </Label>
        <Suspense
          fallback={
            <div className="h-[35vh] rounded-xl bg-neutral-100 animate-pulse" />
          }
        >
          <LocationPicker value={location} onChange={setLocation} />
        </Suspense>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment" className="text-sm font-semibold text-neutral-700">
          Дополнительные комментарии
        </Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Необязательно: подъезд, ориентир, пожелания к подаче..."
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-semibold text-neutral-700">
          Номер телефона клиента
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
          Когда нужен бетон
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
            Как можно скорее
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
            Выбрать время
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
            Отправка...
          </>
        ) : (
          "Заказать бетон"
        )}
      </Button>
    </form>
  );
}
