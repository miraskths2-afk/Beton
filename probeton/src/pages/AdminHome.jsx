import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Inbox, Loader, Clock, CheckCircle2, Plus, X, ChevronDown, ChevronUp, Bell, BarChart3 } from "lucide-react";
import DriverApproval from "@/components/DriverApproval";
import CommissionApproval from "@/components/CommissionApproval";
import DriverPaymentApproval from "@/components/DriverPaymentApproval";
import AdminAnalytics from "@/components/AdminAnalytics";
import QuickOrderForm from "@/components/QuickOrderForm";

export default function AdminHome() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const load = async () => {
    try {
      const data = await base44.entities.Order.list("-created_date", 200);
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    return unsub;
  }, []);

  const total = orders.length;
  const active = orders.filter((o) => (o.status || "new") !== "done").length;
  const done = orders.filter((o) => o.status === "done").length;

  const today = new Date().toDateString();
  const todayCount = orders.filter(
    (o) => new Date(o.created_date).toDateString() === today
  ).length;

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900">
          Здравствуйте, {user?.full_name || "администратор"}
        </h1>
        <p className="text-sm text-neutral-500">Обзор работы за всё время</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <Inbox className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Всего заявок
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-900 tabular-nums">
            {loading ? "—" : total}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Сегодня
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-900 tabular-nums">
            {loading ? "—" : todayCount}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Loader className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              В работе сейчас
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-900 tabular-nums">
            {loading ? "—" : active}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Завершено
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-900 tabular-nums">
            {loading ? "—" : done}
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowForm((v) => !v)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-bold text-sm bg-neutral-900 text-white"
      >
        {showForm ? (
          <>
            <X className="w-4 h-4" />
            Закрыть форму
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Добавить заявку
          </>
        )}
      </button>

      {showForm && <QuickOrderForm />}

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-1 space-y-1">
        <div className="flex items-center gap-2 px-3 pt-2">
          <Bell className="w-4 h-4 text-neutral-500" />
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
            Требует внимания
          </span>
        </div>
        <div className="p-2 space-y-3">
          <DriverApproval />
          <DriverPaymentApproval />
          <CommissionApproval />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <button
          onClick={() => setShowAnalytics((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <BarChart3 className="w-4 h-4 text-neutral-500" />
            Аналитика
          </span>
          {showAnalytics ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>
        {showAnalytics && (
          <div className="px-4 pb-4">
            <AdminAnalytics />
          </div>
        )}
      </div>
    </div>
  );
}
