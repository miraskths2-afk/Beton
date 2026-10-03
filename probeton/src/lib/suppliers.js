import L from "leaflet";
import { supabase } from "@/api/base44Client";
import { t } from "@/lib/i18n";

// Поставщик — бетонный завод, где миксерист, взявший заявку, загружает
// бетон. Аккаунт: app_users.account_type = 'supplier'. Поставщик не видит
// заявок, клиентов и адресов доставки — только миксеристов на линии.
// Точка завода и список марок — в колонках supplier_* (supabase_supplier.sql).

export const SUPPLIER_GRADES = ["М100", "М150", "М200", "М250", "М300", "М350", "М400", "М450", "М500"];

export const SUPPLIER_FIELDS =
  "id, phone, full_name, supplier_company, supplier_address, supplier_lat, supplier_lng, supplier_products, approval_status";

export const supplierName = (s) => s?.supplier_company || s?.full_name || t("Поставщик");

export const supplierProducts = (s) =>
  Array.isArray(s?.supplier_products) ? s.supplier_products.filter((p) => p?.grade) : [];

export const hasPlantPoint = (s) => s?.supplier_lat != null && s?.supplier_lng != null;

// Марка бетона из заявки: сначала поле grade, иначе ищем «М300» в тексте.
export function orderGrade(o) {
  if (o?.grade) return o.grade;
  const m = /[МM]\s?(\d{3})/.exec(o?.what_needed || "");
  return m ? `М${m[1]}` : "";
}

export const formatPrice = (n) =>
  n ? `${Number(n).toLocaleString("ru-RU")} ₸/м³` : t("цена по звонку");

// Одобренные поставщики с отмеченным на карте заводом.
export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from("app_users")
    .select(SUPPLIER_FIELDS)
    .eq("account_type", "supplier")
    .eq("approval_status", "approved");
  if (error) throw error;
  return (data || []).filter(hasPlantPoint);
}

// В базе ещё нет колонок supplier_* — значит, не выполнен SQL.
export const isMissingSupplierSql = (err) => /supplier_/.test(String(err?.message || ""));

export const plantIcon = (highlighted = false) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${
      highlighted ? "#f59e0b" : "#6366f1"
    };width:34px;height:34px;border-radius:8px;border:3px solid #171717;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="font-size:16px">🏭</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
