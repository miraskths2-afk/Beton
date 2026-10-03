import React, { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { Headset, Phone, MessageCircle } from "lucide-react";
import { t } from "@/lib/i18n";

// Номер диспетчера — телефон админа из app_users. Загружаем один раз
// за сессию и держим в памяти.
let cachedPhone = null;

async function fetchAdminPhone() {
  if (cachedPhone) return cachedPhone;
  const { data, error } = await supabase
    .from("app_users")
    .select("phone")
    .eq("role", "admin")
    .order("created_date", { ascending: true })
    .limit(1);
  if (error) throw error;
  const digits = (data?.[0]?.phone || "").replace(/\D/g, "").slice(-10);
  cachedPhone = digits.length === 10 ? digits : null;
  return cachedPhone;
}

// «Помощь с заявкой»: заказчик может позвонить диспетчеру или написать
// ему в WhatsApp, чтобы тот помог оформить заказ и объяснил непонятное.
export default function OrderHelp() {
  const [phone, setPhone] = useState(cachedPhone);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (phone) return;
    fetchAdminPhone()
      .then(setPhone)
      .catch((e) => console.error(e));
  }, [phone]);

  if (!phone) return null;

  const waText = encodeURIComponent(t("Здравствуйте! Помогите, пожалуйста, оформить заявку на бетон."));

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Headset className="w-5 h-5 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-neutral-900">{t("Нужна помощь с заявкой?")}</div>
          <div className="text-[11px] text-neutral-500">
            {t("Диспетчер поможет заполнить и объяснит непонятное")}
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold text-blue-600">{t("Помощь")}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <a
            href={`tel:+7${phone}`}
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-neutral-900 text-white text-sm font-bold"
          >
            <Phone className="w-4 h-4" />
            {t("Позвонить")}
          </a>
          <a
            href={`https://wa.me/7${phone}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-green-600 text-white text-sm font-bold"
          >
            <MessageCircle className="w-4 h-4" />
            {t("Написать")}
          </a>
        </div>
      )}
    </div>
  );
}
