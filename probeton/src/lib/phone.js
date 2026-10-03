// Номера телефонов (Казахстан, +7).
// В базе номера лежат в разных видах (7071234567, 87071234567,
// +77071234567) — сравниваем всегда по последним 10 цифрам.

// 10 цифр номера после +7 (или меньше, если номер ещё не дописан).
export function phoneLocal(value) {
  const str = String(value || "").trim();
  // «+7…» — всё после +7 (в том числе недописанный номер).
  if (str.startsWith("+7")) return str.slice(2).replace(/\D/g, "").slice(0, 10);
  const d = str.replace(/\D/g, "");
  // 87071234567 / 77071234567 и т.п. — последние 10 цифр.
  return d.length > 10 ? d.slice(-10) : d;
}

// Полный номер «+7XXXXXXXXXX» из 10 цифр (пусто, если цифр нет).
export function phoneFull(value) {
  const local = phoneLocal(value);
  return local ? `+7${local}` : "";
}

export const isPhoneComplete = (value) => phoneLocal(value).length === 10;

// «7071234567» → «707 123 45 67»
export function formatPhoneLocal(local) {
  const d = local || "";
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)]
    .filter(Boolean)
    .join(" ");
}
