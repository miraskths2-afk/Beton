import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getEffectiveRole } from "@/lib/effectiveRole";
import {
  Factory,
  Plus,
  X,
  Loader2,
  Phone,
  MapPin,
  Users,
  Pencil,
  ChevronDown,
  ChevronUp,
  Power,
  UserX,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { fetchPlants, findUserByPhone, plantName, plantsErrorText } from "@/lib/plants";
import PointsMap from "@/components/PointsMap";
import LocationPicker from "@/components/LocationPicker";
import FleetManager from "@/components/FleetManager";

// Форма завода: новый (с номером телефона) или изменение существующего.
function PlantForm({ plant, onSaved, onCancel }) {
  const isNew = !plant;
  const [phone, setPhone] = useState("");
  const [name, setName] = useState(plant?.full_name || "");
  const [address, setAddress] = useState(plant?.plant_address || "");
  const [point, setPoint] = useState(
    plant?.plant_lat != null && plant?.plant_lng != null
      ? { lat: plant.plant_lat, lng: plant.plant_lng }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError(t("Введите название завода"));
      return;
    }
    if (!point) {
      setError(t("Отметьте завод на карте"));
      return;
    }
    setSaving(true);
    try {
      const fields = {
        full_name: name.trim(),
        plant_address: address.trim() || null,
        plant_lat: point.lat,
        plant_lng: point.lng,
      };
      if (isNew) {
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10) {
          setError(t("Введите корректный номер телефона"));
          return;
        }
        const existing = await findUserByPhone(digits);
        const plantFields = {
          ...fields,
          account_type: "plant",
          plant_id: null,
          plant_active: true,
          approval_status: "approved",
        };
        if (existing) {
          if (existing.role === "admin") {
            setError(t("Этот номер принадлежит администратору."));
            return;
          }
          if (existing.account_type === "plant") {
            setError(t("Этот номер уже завод."));
            return;
          }
          const was = existing.account_type === "driver" ? t("водитель") : t("заказчик");
          if (!confirm(t("Номер уже зарегистрирован ({was}). Сделать этот аккаунт заводом?", { was }))) return;
          const { error: upErr } = await supabase
            .from("app_users")
            .update(plantFields)
            .eq("id", existing.id);
          if (upErr) throw upErr;
        } else {
          const { error: insErr } = await supabase
            .from("app_users")
            .insert({ phone: digits, role: "user", ...plantFields });
          if (insErr) throw insErr;
        }
      } else {
        const { error: upErr } = await supabase
          .from("app_users")
          .update(fields)
          .eq("id", plant.id);
        if (upErr) throw upErr;
        // Название завода хранится и в его заявках — обновим и там.
        if (fields.full_name !== plant.full_name) {
          await supabase
            .from("orders")
            .update({ plant_name: fields.full_name })
            .eq("plant_id", plant.id);
        }
      }
      onSaved();
    } catch (err) {
      console.error(err);
      setError(t(plantsErrorText(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={save}
      className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3"
    >
      <div className="font-bold text-neutral-900 text-sm">
        {isNew ? t("Новый завод") : t("Изменить завод")}
      </div>
      {isNew && (
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">
            {t("Номер телефона завода (по нему завод входит на сайт)")}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 7__ ___ __ __"
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">{t("Название")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("Например: БСУ Алатау")}
          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">{t("Где находится завод")}</label>
        <LocationPicker value={point} onChange={setPoint} onAddress={setAddress} height="30vh" />
      </div>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder={t("Адрес")}
        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("Сохранить")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-bold"
        >
          {t("Отмена")}
        </button>
      </div>
    </form>
  );
}

function AdminPlants() {
  const [plants, setPlants] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [openFleet, setOpenFleet] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const list = await fetchPlants();
      setPlants(list);
      const ids = list.map((p) => p.id);
      const next = {};
      if (ids.length) {
        const [{ data: fleet }, { data: orders }] = await Promise.all([
          supabase.from("app_users").select("plant_id").in("plant_id", ids),
          supabase
            .from("orders")
            .select("plant_id")
            .in("plant_id", ids)
            .not("status", "in", "(done,cancelled)"),
        ]);
        for (const id of ids) {
          next[id] = {
            fleet: (fleet || []).filter((r) => r.plant_id === id).length,
            orders: (orders || []).filter((r) => r.plant_id === id).length,
          };
        }
      }
      setStats(next);
      setError("");
    } catch (e) {
      console.error(e);
      setError(t(plantsErrorText(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (p) => {
    setBusyId(p.id);
    try {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ plant_active: !p.plant_active })
        .eq("id", p.id);
      if (upErr) throw upErr;
      setPlants((prev) => prev.map((x) => (x.id === p.id ? { ...x, plant_active: !p.plant_active } : x)));
    } catch (e) {
      console.error(e);
      setError(t(plantsErrorText(e)));
    } finally {
      setBusyId(null);
    }
  };

  const removePlantRole = async (p) => {
    if (
      !confirm(
        t("Убрать у «{name}» статус завода? Аккаунт станет обычным заказчиком, миксеристы его парка станут независимыми, а заявки без миксера вернутся в общую ленту.", { name: plantName(p) })
      )
    )
      return;
    setBusyId(p.id);
    try {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ account_type: "client" })
        .eq("id", p.id);
      if (upErr) throw upErr;
      await load();
    } catch (e) {
      console.error(e);
      setError(t(plantsErrorText(e)));
    } finally {
      setBusyId(null);
    }
  };

  const working = plants.filter((p) => p.plant_active);

  return (
    <div className="p-4 space-y-4">
      <div className="px-1 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-black text-neutral-900">{t("Заводы")}</h1>
          <p className="text-sm text-neutral-500">{t("Карта работающих заводов и БСУ")}</p>
        </div>
        <button
          onClick={() => {
            setShowAdd((v) => !v);
            setEditId(null);
          }}
          className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
        >
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? t("Закрыть") : t("Добавить завод")}
        </button>
      </div>

      {showAdd && (
        <PlantForm
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <PointsMap
        points={working.map((p) => ({
          id: p.id,
          lat: p.plant_lat,
          lng: p.plant_lng,
          kind: "plant",
          title: plantName(p),
          subtitle: [
            p.plant_address,
            t("Парк: {n}", { n: stats[p.id]?.fleet ?? 0 }),
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      <h2 className="font-bold text-neutral-900 px-1 text-sm">
        {t("Все заводы ({n}) · работают: {active}", { n: plants.length, active: working.length })}
      </h2>

      {loading ? (
        <div className="text-center py-10 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : plants.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
          <Factory className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t("Заводов пока нет. Нажмите «Добавить завод».")}
        </div>
      ) : (
        <div className="space-y-3">
          {plants.map((p) =>
            editId === p.id ? (
              <PlantForm
                key={p.id}
                plant={p}
                onSaved={() => {
                  setEditId(null);
                  load();
                }}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <div
                key={p.id}
                className={cn(
                  "bg-white rounded-2xl border shadow-sm p-4 space-y-3",
                  p.plant_active ? "border-neutral-200" : "border-neutral-200 opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-neutral-900 flex items-center gap-2">
                      <Factory className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="truncate">{plantName(p)}</span>
                    </div>
                    {p.plant_address && (
                      <div className="text-xs text-neutral-500 flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        {p.plant_address}
                      </div>
                    )}
                    {p.plant_lat == null && (
                      <div className="text-xs font-semibold text-amber-600 mt-1">
                        {t("Не отмечен на карте")}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold",
                      p.plant_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
                    )}
                  >
                    {p.plant_active ? t("Работает") : t("Не работает")}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                  <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                    <Phone className="w-3 h-3" />
                    {p.phone}
                  </a>
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {t("Парк: {n}", { n: stats[p.id]?.fleet ?? 0 })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" />
                    {t("Заявок в работе: {n}", { n: stats[p.id]?.orders ?? 0 })}
                  </span>
                  {p.approval_status !== "approved" && (
                    <span className="font-semibold text-amber-600">
                      {t("Ждёт одобрения на Главной")}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setOpenFleet(openFleet === p.id ? null : p.id)}
                    className="text-xs font-bold py-2 rounded-lg bg-neutral-100 text-neutral-700 inline-flex items-center justify-center gap-1"
                  >
                    {openFleet === p.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {t("Парк")}
                  </button>
                  <button
                    onClick={() => {
                      setEditId(p.id);
                      setShowAdd(false);
                    }}
                    className="text-xs font-bold py-2 rounded-lg bg-neutral-100 text-neutral-700 inline-flex items-center justify-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t("Изменить")}
                  </button>
                  <button
                    onClick={() => toggleActive(p)}
                    disabled={busyId === p.id}
                    className={cn(
                      "text-xs font-bold py-2 rounded-lg inline-flex items-center justify-center gap-1 disabled:opacity-50",
                      p.plant_active ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                    )}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {p.plant_active ? t("Выключить") : t("Включить")}
                  </button>
                </div>

                {openFleet === p.id && (
                  <div className="pt-2 border-t border-neutral-100 space-y-3">
                    <FleetManager plantId={p.id} isAdmin />
                    <button
                      onClick={() => removePlantRole(p)}
                      disabled={busyId === p.id}
                      className="w-full text-xs font-bold py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      {t("Убрать статус завода")}
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Страница доступна только админу (в режиме просмотра «Админ»).
export default function AdminPlantsPage() {
  const { user, viewMode } = useAuth();
  if (getEffectiveRole(user, viewMode) !== "admin") return <Navigate to="/" replace />;
  return <AdminPlants />;
}
