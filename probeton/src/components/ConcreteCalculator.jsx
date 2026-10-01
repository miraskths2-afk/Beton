import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Calculator, Loader2, CheckCircle2 } from "lucide-react";
import { isBlacklisted } from "@/lib/blacklist";
import { t, locale } from "@/lib/i18n";

const GRADES = [
  { value: "М150", price: 21000 },
  { value: "М200", price: 22500 },
  { value: "М300", price: 24000 },
  { value: "М400", price: 26500 },
];

export default function ConcreteCalculator() {
  const [grade, setGrade] = useState("М200");
  const [cubes, setCubes] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const selectedGrade = useMemo(
    () => GRADES.find((g) => g.value === grade) ?? GRADES[1],
    [grade]
  );

  const cubesNum = parseFloat(cubes) || 0;
  const total = useMemo(
    () => selectedGrade.price * cubesNum,
    [selectedGrade, cubesNum]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cubesNum || !phone.trim()) return;
    if (await isBlacklisted(phone.trim())) {
      alert(t("Этот номер в чёрном списке PROBETON. Заказ недоступен."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await base44.entities.Order.create({
        order_number: "PB-" + Date.now().toString().slice(-6),
        what_needed: `${cubesNum} куб. ${grade} (по ${selectedGrade.price.toLocaleString(
          "ru-RU"
        )} ₸/куб) — доставка. Тел. клиента в поле phone.`,
        phone: phone.trim(),
        order_type: "calculator",
        grade,
        price_per_cube: selectedGrade.price,
        cubes: cubesNum,
        total,
        status: "new",
      });
      setSuccess(true);
      setCubes("");
      setPhone("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          t("Не удалось сохранить заявку. Проверьте подключение и попробуйте ещё раз.")
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
        <h3 className="font-bold text-lg text-neutral-900">{t("Заказ рассчитан и отправлен!")}</h3>
        <p className="text-sm text-neutral-500 mt-1">
          {t("Менеджер перезвонит для подтверждения доставки.")}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900">{t("Калькулятор бетона")}</h2>
          <p className="text-xs text-neutral-500">{t("Выберите марку и укажите объём")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-neutral-700">{t("Марка бетона")}</Label>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRADES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.value} — {g.price.toLocaleString(locale())} {t("₸/куб")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cubes" className="text-sm font-semibold text-neutral-700">
          {t("Количество кубов")}
        </Label>
        <Input
          id="cubes"
          type="number"
          min="0"
          step="0.5"
          value={cubes}
          onChange={(e) => setCubes(e.target.value)}
          placeholder={t("Напр.: 7.5")}
          className="h-12 rounded-xl"
          required
        />
      </div>

      <div className="rounded-xl bg-neutral-900 text-white p-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold">
            {t("Итого")}
          </div>
          <div className="text-2xl font-black tabular-nums">
            {total.toLocaleString(locale())} ₸
          </div>
        </div>
        <div className="text-right text-xs text-neutral-400">
          {selectedGrade.price.toLocaleString(locale())} ₸ × {cubesNum || 0} {t("куб")}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cphone" className="text-sm font-semibold text-neutral-700">
          {t("Номер телефона клиента")}
        </Label>
        <Input
          id="cphone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          className="h-12 rounded-xl"
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
        disabled={loading || !cubesNum || !phone.trim()}
        className="w-full bg-amber-400 hover:bg-amber-300 text-neutral-900 font-bold h-12 rounded-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t("Отправка...")}
          </>
        ) : (
          t("Оформить заказ")
        )}
      </Button>
    </form>
  );
}
