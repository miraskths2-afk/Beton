// Тёмная / светлая тема.
// Выбор хранится в браузере (localStorage). "system" — как в настройках
// телефона. Класс "dark" вешается на <html>; первичное применение
// делается ещё в index.html (маленький скрипт), чтобы при загрузке не
// было "вспышки" белого экрана.

const THEME_KEY = "probeton_theme";

export const THEMES = [
  { id: "light", label: "Светлая" },
  { id: "dark", label: "Тёмная" },
  { id: "system", label: "Как в телефоне" },
];

export function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // игнорируем
  }
  return "light";
}

function isDark(theme) {
  if (theme === "dark") return true;
  if (theme === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export function applyTheme(theme = getTheme()) {
  const dark = isDark(theme);
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#000000" : "#171717");
}

export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // игнорируем
  }
  applyTheme(theme);
}

// Если выбрано "как в телефоне" — следим за сменой темы в системе.
export function watchSystemTheme() {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return () => {};
  const onChange = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}
