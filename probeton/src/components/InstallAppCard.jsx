import React, { useState } from "react";
import { usePwaInstall } from "@/lib/usePwaInstall";
import { Download, Share, CheckCircle2, X } from "lucide-react";
import { t } from "@/lib/i18n";

export default function InstallAppCard() {
  const { canInstall, installed, isIOS, promptInstall } = usePwaInstall();
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (installed || dismissed) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-neutral-300 hover:text-neutral-500"
        aria-label={t("Скрыть")}
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 pr-6">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <div className="font-bold text-sm text-neutral-900">
            {t("Установить как приложение")}
          </div>
          <div className="text-xs text-neutral-500">
            {t("Быстрый доступ с экрана телефона, без браузера")}
          </div>
        </div>
      </div>

      {canInstall && (
        <button
          onClick={promptInstall}
          className="w-full bg-neutral-900 text-white font-semibold text-sm py-2.5 rounded-xl"
        >
          {t("Установить")}
        </button>
      )}

      {isIOS && !canInstall && (
        <div>
          <button
            onClick={() => setShowIosHint((v) => !v)}
            className="w-full bg-neutral-900 text-white font-semibold text-sm py-2.5 rounded-xl"
          >
            {t("Как установить на iPhone")}
          </button>
          {showIosHint && (
            <div className="mt-2 text-xs text-neutral-600 bg-neutral-50 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Share className="w-3.5 h-3.5 shrink-0" />
                {t("1. Нажмите кнопку «Поделиться» внизу экрана Safari")}
              </div>
              <div>{t("2. Выберите «На экран «Домой»»")}</div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {t("3. Готово — иконка появится на рабочем столе")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
