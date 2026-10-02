import React, { useState, useMemo } from "react";
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
import { Calculator, Truck } from "lucide-react";
import { t, locale } from "@/lib/i18n";
import { trucksEstimate, trucksText } from "@/lib/orderExtras";

const GRADES = [
  { value: "М150", price: 21000 },
  { value: "М200", price: 22500 },
  { value: "М300", price: 24000 },
  { value: "М400", price: 26500 },
];

// Калькулятор считает стоимость и передаёт марку и кубы в форму
// заказа — там клиент указывает адрес, способ выгрузки, фото заезда.
export default function ConcreteCalculator({ onOrder }) {
  const [grade, setGrade] = useState("М200");
  const [cubes, setCubes] = useState("");

  const selectedGrade = useMemo(
    () => GRADES.find((g) => g.value === grade) ?? GRADES[1],
    [grade]
  );

  const cubesNum = parseFloat(cubes) || 0;
  const total = useMemo(
    () => selectedGrade.price * cubesNum,
    [selectedGrade, cubesNum]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cubesNum) return;
    onOrder?.({
      grade,
      cubes: cubesNum,
      price_per_cube: selectedGrade.price,
      order_type: "calculator",
    });
  };

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

      {cubesNum > 0 && (
        <div className="flex items-center gap-2 text-xs text-neutral-700 bg-neutral-100 rounded-lg px-3 py-2">
          <Truck className="w-4 h-4 shrink-0 text-neutral-500" />
          {t("Понадобится примерно {trucks}", { trucks: trucksText(trucksEstimate(cubesNum)) })}
        </div>
      )}

      <Button
        type="submit"
        disabled={!cubesNum}
        className="w-full bg-amber-400 hover:bg-amber-300 text-neutral-900 font-bold h-12 rounded-xl"
      >
        {t("Оформить заказ")}
      </Button>
    </form>
  );
}
