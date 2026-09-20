import { useState } from "react";
import {
  UserCircle,
  Phone,
  Truck,
  ShieldCheck,
  Bell,
  FileText,
  ChevronDown,
  ChevronUp,
  LogOut,
  Pencil,
  Check,
  X,
  Ban,
  History,
  Flame,
  LayoutDashboard,
  RefreshCcw,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import TermsContent from "@/components/TermsContent";
import BlacklistManager from "@/components/BlacklistManager";
import DriverHistory from "@/components/DriverHistory";
import MyIntercepts from "@/components/MyIntercepts";
import { requestNotificationPermission } from "@/lib/notifications";

function roleLabel(user) {
  if (user?.role === "admin") return "Администратор";
  if (user?.account_type === "driver") return "Водитель";
  return "Заказчик / Прораб";
}

function approvalLabel(status) {
  if (status === "approved") return "Подтверждён";
  if (status === "rejected") return "Отклонён";
  return "На проверке";
}

export default function Profile() {
  const { user, logout, checkUserAuth, viewMode, setViewMode } = useAuth();
  const [openSection, setOpenSection] = useState(null);
  const [notif, setNotif] = useState(user?.notifications_enabled !== false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  const startEditName = () => {
    setNameDraft(user?.full_name || "");
    setNameError("");
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length < 2) {
      setNameError("Введите имя (минимум 2 буквы)");
      return;
    }
    setSavingName(true);
    setNameError("");
    try {
      await base44.auth.updateMe({ full_name: trimmed });
      await checkUserAuth();
      setEditingName(false);
    } catch (err) {
      console.error(err);
      setNameError("Не удалось сохранить. Попробуйте ещё раз.");
    } finally {
      setSavingName(false);
    }
  };

  const toggle = (id) => setOpenSection((s) => (s === id ? null : id));

  const toggleNotif = async () => {
    const next = !notif;
    setNotif(next);
    setSavingNotif(true);
    try {
      await base44.auth.updateMe({ notifications_enabled: next });
      await checkUserAuth();
      if (next) {
        await requestNotificationPermission();
      }
    } catch (err) {
      console.error(err);
      setNotif(!next);
    } finally {
      setSavingNotif(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">Мой профиль</h1>
      </div>

      <h2 className="font-bold text-neutral-900 px-1">Личные данные</h2>
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <UserCircle className="w-8 h-8 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Ваше имя"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {nameError && (
                  <p className="text-xs text-red-600">{nameError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold disabled:opacity-60"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    disabled={savingName}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 text-xs font-bold"
                  >
                    <X className="w-3.5 h-3.5" />
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="font-black text-neutral-900 text-lg leading-tight truncate">
                  {user?.full_name || "—"}
                </div>
                <button
                  onClick={startEditName}
                  className="shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                  aria-label="Изменить имя"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="text-xs text-neutral-500">{roleLabel(user)}</div>
          </div>
        </div>

        <div className="space-y-2 text-sm pt-1 border-t border-neutral-100">
          <div className="flex items-center gap-2 text-neutral-600 pt-2">
            <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
            {user?.phone}
          </div>

          {user?.account_type === "driver" && (
            <>
              {user?.vehicle_plate && (
                <div className="flex items-center gap-2 text-neutral-600">
                  <Truck className="w-4 h-4 text-neutral-400 shrink-0" />
                  Гос. номер: {user.vehicle_plate}
                </div>
              )}
              {user?.equipment_type && (
                <div className="flex items-center gap-2 text-neutral-600">
                  <Truck className="w-4 h-4 text-neutral-400 shrink-0" />
                  Техника: {user.equipment_type}
                </div>
              )}
              <div className="flex items-center gap-2 text-neutral-600">
                <ShieldCheck className="w-4 h-4 text-neutral-400 shrink-0" />
                Статус партнёра: {approvalLabel(user?.approval_status)}
              </div>
            </>
          )}
        </div>
      </section>

      {user?.role === "admin" && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-4 h-4 text-neutral-500" />
            <span className="font-bold text-neutral-900">Режим просмотра</span>
          </div>
          <p className="text-xs text-neutral-500 -mt-2">
            Ваша роль остаётся администратором — это просто переключение,
            какой интерфейс сейчас показывать.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "admin", label: "Админ", icon: LayoutDashboard },
              { id: "client", label: "Заказчик", icon: Truck },
              { id: "driver", label: "Водитель", icon: UserCircle },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setViewMode(opt.id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                  (viewMode || "admin") === opt.id
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-600 border-neutral-200"
                }`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle("settings")}
          className="w-full flex items-center justify-between p-4"
        >
          <span className="font-bold text-neutral-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-neutral-500" />
            Настройки
          </span>
          {openSection === "settings" ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>
        {openSection === "settings" && (
          <div className="px-4 pb-4 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-800">
                  Уведомления
                </div>
                <div className="text-xs text-neutral-500">
                  О новых заказах и изменениях статуса
                </div>
              </div>
              <button
                onClick={toggleNotif}
                disabled={savingNotif}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                  notif ? "bg-green-500" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    notif ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </section>

      {user?.role !== "admin" && user?.account_type !== "driver" && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <button
            onClick={() => toggle("myIntercepts")}
            className="w-full flex items-center justify-between p-4"
          >
            <span className="font-bold text-neutral-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Перехваченные остатки
            </span>
            {openSection === "myIntercepts" ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
          {openSection === "myIntercepts" && (
            <div className="px-4 pb-4 pt-3 border-t border-neutral-100">
              <MyIntercepts phone={user?.phone} />
            </div>
          )}
        </section>
      )}

      {user?.role === "admin" && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <button
            onClick={() => toggle("blacklist")}
            className="w-full flex items-center justify-between p-4"
          >
            <span className="font-bold text-neutral-900 flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-500" />
              Чёрный список
            </span>
            {openSection === "blacklist" ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
          {openSection === "blacklist" && (
            <div className="px-4 pb-4 pt-3 border-t border-neutral-100">
              <BlacklistManager />
            </div>
          )}
        </section>
      )}

      {user?.role === "admin" && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <button
            onClick={() => toggle("driverHistory")}
            className="w-full flex items-center justify-between p-4"
          >
            <span className="font-bold text-neutral-900 flex items-center gap-2">
              <History className="w-4 h-4 text-neutral-500" />
              История миксеристов
            </span>
            {openSection === "driverHistory" ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
          {openSection === "driverHistory" && (
            <div className="px-4 pb-4 pt-3 border-t border-neutral-100">
              <DriverHistory />
            </div>
          )}
        </section>
      )}

      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle("legal")}
          className="w-full flex items-center justify-between p-4"
        >
          <span className="font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-500" />
            Документы и соглашения
          </span>
          {openSection === "legal" ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>
        {openSection === "legal" && (
          <div className="px-4 pb-4 pt-3 border-t border-neutral-100 text-sm">
            <TermsContent />
          </div>
        )}
      </section>

      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 text-red-600 font-bold bg-red-50"
      >
        <LogOut className="w-4 h-4" />
        Выйти из аккаунта
      </button>
    </div>
  );
}
