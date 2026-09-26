// Переводы интерфейса (RU / KZ).
//
// Как это устроено: русский текст в коде остаётся как есть, но
// оборачивается в t("..."). Если выбран казахский — t() ищет перевод
// в словаре src/i18n/kk/*.js (ключ = русская фраза). Если перевода нет,
// показывается русский текст — поэтому ничего не ломается, даже если
// какая-то фраза ещё не переведена.
//
// Подстановки: t("Нужен к: {date}", { date: "12.05" }).
//
// t() — обычная функция, а не хук: её можно вызывать где угодно, в том
// числе после условного return (правило про хуки не нарушается).
// Язык меняется с перезагрузкой страницы — так гарантированно
// перерисовывается весь интерфейс.

import kk from "@/i18n/kk";

const LANG_KEY = "probeton_lang";

export const LANGS = [
  { id: "ru", label: "Русский", short: "RU" },
  { id: "kk", label: "Қазақша", short: "KZ" },
];

function readLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "ru" || saved === "kk") return saved;
  } catch {
    // localStorage может быть недоступен (приватный режим) — не страшно
  }
  return "ru";
}

let current = readLang();

if (typeof document !== "undefined") {
  document.documentElement.lang = current === "kk" ? "kk" : "ru";
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (lang === current) return;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // игнорируем
  }
  current = lang;
  window.location.reload();
}

// Локаль для дат и чисел (toLocaleString).
export function locale() {
  return current === "kk" ? "kk-KZ" : "ru-RU";
}

// Язык для распознавания речи (голосовой ввод).
export function speechLang() {
  return current === "kk" ? "kk-KZ" : "ru-RU";
}

export function t(text, params) {
  if (text == null) return text;
  let out = current === "kk" ? kk[text] ?? text : text;
  if (params) {
    out = out.replace(/\{(\w+)\}/g, (m, key) =>
      params[key] != null ? String(params[key]) : m
    );
  }
  return out;
}
