import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { Factory, Plus, Trash2, Loader2, Check, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import LocationPicker from "@/components/LocationPicker";
import {
  SUPPLIER_GRADES,
  supplierProducts,
  isMissingSupplierSql,
} from "@/lib/suppliers";
import { t } from "@/lib/i18n";

// «Мой завод» у поставщика: название, точка завода на карте и какие марки
// бетона он продаёт (цена за м³ — по желанию). Миксеристы видят это,
// когда ищут, где загрузиться под принятую заявку.
export default function SupplierPlant() {
  const { user, viewMode, checkUserAuth } = useAuth();
  const role = getEffectiveRole(user, viewMode);
  const [company, setCompany] = useState(user?.supplier_company || "");
  const [address, setAddress] = useState(user?.supplier_address || "");
  const [point, setPoint] = useState(
    user?.supplier_lat != null && user?.supplier_lng != null
      ? { lat: user.supplier_lat, lng: user.supplier_lng }
      : null
  );
  const [products, setProducts] = useState(() =>
    supplierProducts(user).map((p) => ({ grade: p.grade, price: p.price ? String(p.price) : "" }))
  );
  const [newGrade, setNewGrade] = useState("М300");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (role !== "supplier") return <Navigate to="/" replace />;

  const freeGrades = SUPPLIER_GRADES.filter((g) => !products.some((p) => p.grade === g));

  const addProduct = () => {
    const grade = freeGrades.includes(newGrade) ? newGrade : freeGrades[0];
    if (!grade) return;
    setProducts((prev) => [...prev, { grade, price: "" }]);
    setNewGrade(freeGrades.find((g) => g !== grade) || "");
    setSaved(false);
  };

  const setPrice = (grade, price) => {
    setProducts((prev) =>
      prev.map((p) => (p.grade === grade ? { ...p, price: price.replace(/\D/g, "").slice(0, 7) } : p))
    );
    setSaved(false);
  };

  const removeProduct = (grade) => {
    setProducts((prev) => prev.filter((p) => p.grade !== grade));
    setSaved(false);
  };

  const save = async () => {
    if (!point) {
      setError(t("Отметьте на карте, где находится ваш завод"));
      return;
    }
    if (products.length === 0) {
      setError(t("Добавьте хотя бы одну марку бетона"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await base44.auth.updateMe({
        supplier_company: company.trim() || null,
        supplier_address: address.trim() || null,
        supplier_lat: point.lat,
        supplier_lng: point.lng,
        supplier_products: products
          .slice()
          .sort((a, b) => SUPPLIER_GRADES.indexOf(a.grade) - SUPPLIER_GRADES.indexOf(b.grade))
          .map((p) => ({ grade: p.grade, price: p.price ? Number(p.price) : null })),
      });
      await checkUserAuth();
      setSaved(true);
    } catch (err) {
      console.error(err);
      setError(
        isMissingSupplierSql(err)
          ? t("В базе ещё не выполнен SQL для поставщиков (supabase_supplier.sql). Сообщите администратору.")
          : t("Не удалось сохранить, попробуйте ещё раз")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
          <Factory className="w-5 h-5 text-indigo-600" />
          {t("Мой завод")}
        </h1>
        <p className="text-sm text-neutral-500">
          {t("Миксеристы с заявкой увидят ваш завод на карте и смогут приехать за бетоном")}
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <label className="block">
          <span className="text-xs font-bold text-neutral-500">{t("Название завода")}</span>
          <input
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setSaved(false);
            }}
            placeholder={t("Например: БСУ «Алатау»")}
            className="mt-1 w-full h-11 px-3 rounded-xl border border-neutral-200 bg-white text-sm"
            maxLength={80}
          />
        </label>
        <div>
          <span className="text-xs font-bold text-neutral-500">{t("Где находится завод")}</span>
          <div className="mt-1">
            <LocationPicker
              value={point}
              onChange={(p) => {
                setPoint(p);
                setSaved(false);
              }}
              onAddress={setAddress}
              height="40vh"
            />
          </div>
        </div>
        {point && (
          <label className="block">
            <span className="text-xs font-bold text-neutral-500 inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {t("Адрес завода")}
            </span>
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setSaved(false);
              }}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-neutral-200 bg-white text-sm"
              maxLength={200}
            />
          </label>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <div>
          <div className="font-bold text-neutral-900">{t("Какой бетон продаёте")}</div>
          <div className="text-xs text-neutral-500">
            {t("Цена за 1 м³ — по желанию. Без цены миксерист договорится по звонку.")}
          </div>
        </div>
        {products.map((p) => (
          <div key={p.grade} className="flex items-center gap-2">
            <div className="w-16 shrink-0 font-black text-neutral-900">{p.grade}</div>
            <input
              inputMode="numeric"
              value={p.price}
              onChange={(e) => setPrice(p.grade, e.target.value)}
              placeholder={t("Цена, ₸ за м³")}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm"
            />
            <button
              onClick={() => removeProduct(p.grade)}
              className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"
              aria-label={t("Удалить")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {freeGrades.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={freeGrades.includes(newGrade) ? newGrade : freeGrades[0]}
              onChange={(e) => setNewGrade(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm"
            >
              {freeGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button
              onClick={addProduct}
              className="h-10 px-4 rounded-xl bg-neutral-100 text-neutral-800 text-sm font-bold inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {t("Добавить")}
            </button>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600 px-1">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-neutral-900 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <Check className="w-4 h-4" />
        ) : null}
        {saved ? t("Сохранено") : t("Сохранить")}
      </button>
    </div>
  );
}
