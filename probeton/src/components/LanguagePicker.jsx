import { Globe } from "lucide-react";
import { LANGS, getLang, setLang } from "@/lib/i18n";

// Выбор языка на экранах входа и регистрации (до того, как человек
// попадёт в профиль). Выбор сохраняется в телефоне и действует дальше
// везде; поменять его потом можно в профиле.
export default function LanguagePicker({ className = "" }) {
  const current = getLang();
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full p-1 bg-white border border-neutral-200 ${className}`}
    >
      <Globe
        className="w-4 h-4 mx-1 text-neutral-400"
        aria-hidden="true"
      />
      {LANGS.map((opt) => {
        const active = current === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setLang(opt.id)}
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              active ? "bg-neutral-900 text-white" : "text-neutral-600"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
