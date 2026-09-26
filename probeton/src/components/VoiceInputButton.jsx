import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, speechLang } from "@/lib/i18n";

// Голосовой ввод через встроенное в браузер распознавание речи
// (Chrome на Android, Safari на iPhone). Ничего платного не нужно.
// Если браузер не умеет распознавать речь — кнопка просто не показывается.
//
// onText(text) вызывается с распознанной фразой — поле само решает,
// дописать её к уже введённому тексту или заменить.

function getRecognitionClass() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Склеивает уже введённый текст и новую надиктованную фразу.
export function appendSpoken(prev, spoken) {
  const base = (prev || "").trimEnd();
  if (!base) return spoken;
  return `${base} ${spoken}`;
}

export default function VoiceInputButton({ onText, className }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const Recognition = getRecognitionClass();

  // При уходе со страницы — останавливаем микрофон.
  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        // игнорируем
      }
    };
  }, []);

  if (!Recognition) return null;

  const start = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Recognition();
    rec.lang = speechLang();
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        alert(t("Разрешите доступ к микрофону в настройках браузера."));
      }
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      console.error(err);
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      className={cn(
        "shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-colors",
        listening
          ? "bg-red-600 border-red-600 text-white animate-pulse"
          : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100",
        className
      )}
      aria-label={listening ? t("Остановить запись") : t("Надиктовать голосом")}
      title={listening ? t("Остановить запись") : t("Надиктовать голосом")}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
