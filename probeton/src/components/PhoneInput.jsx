// Поле телефона как в Kaspi: «+7» уже стоит, человек вводит только
// остальные 10 цифр. Наружу отдаёт номер в виде «+7XXXXXXXXXX».
import { cn } from "@/lib/utils";
import { phoneLocal, formatPhoneLocal } from "@/lib/phone";

export default function PhoneInput({ value, onChange, className, ...props }) {
  const local = phoneLocal(value);

  const handleChange = (e) => {
    const raw = e.target.value;
    let d = raw.replace(/\D/g, "");
    // Вставили или подставили целый номер (+7 707…, 8 707…) — берём
    // последние 10 цифр. Если просто дописали лишнюю цифру в конец
    // готового номера — она не идёт.
    const typedAtEnd = local && raw.startsWith(formatPhoneLocal(local));
    if (d.length > 10 && !typedAtEnd) d = d.slice(-10);
    // По привычке начали с 8 — после +7 она не нужна.
    if (d.startsWith("8")) d = d.slice(1);
    d = d.slice(0, 10);
    onChange(d ? `+7${d}` : "");
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base md:text-sm text-neutral-900">
        +7
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={formatPhoneLocal(local)}
        onChange={handleChange}
        placeholder="700 000 00 00"
        pattern="\d{3} \d{3} \d{2} \d{2}"
        title="Введите 10 цифр номера после +7"
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        {...props}
      />
    </div>
  );
}
