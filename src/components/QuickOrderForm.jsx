import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2, CheckCircle2 } from "lucide-react";
import { isBlacklisted } from "@/lib/blacklist";

export default function QuickOrderForm() {
  const [whatNeeded, setWhatNeeded] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!whatNeeded.trim() || !phone.trim()) return;
    if (await isBlacklisted(phone.trim())) {
      alert("Этот номер в чёрном списке PROBETON. Заказ недоступен.");
      return;
    }
    setLoading(true);
    try {
      await base44.entities.Order.create({
        order_number: "PB-" + Date.now().toString().slice(-6),
        what_needed: whatNeeded.trim(),
        phone: phone.trim(),
        order_type: "quick",
        status: "new",
      });
      setSuccess(true);
      setWhatNeeded("");
      setPhone("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error(err);
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
          <p className="text-xs text-neutral-500">Заполните два поля — мы перезвоним</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="what" className="text-sm font-semibold text-neutral-700">
          Что нужно и куда везти
        </Label>
        <Textarea
          id="what"
          value={whatNeeded}
          onChange={(e) => setWhatNeeded(e.target.value)}
          placeholder="Напр.: 5 кубов М200 на стройку в Наурызбайском районе"
          rows={3}
          className="resize-none"
          required
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
          required
        />
      </div>

      <Button
        type="submit"
        disabled={loading || !whatNeeded.trim() || !phone.trim()}
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
