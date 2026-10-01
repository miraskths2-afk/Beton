import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { MessageCircle, Flame, Truck, Search, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "@/components/Skeleton";
import { loadMyChats, subscribeChatChanges, chatPath, displayText } from "@/lib/chat";
import { t, locale } from "@/lib/i18n";

function fmtWhen(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(locale(), { day: "2-digit", month: "2-digit" });
}

// Список переписок — как главный экран WhatsApp. Админ видит все чаты.
export default function ChatsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | order | leftover | unread
  const [query, setQuery] = useState("");
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let mounted = true;
    let timer = null;
    const load = async () => {
      try {
        const list = await loadMyChats(user);
        if (mounted) setChats(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const unsub = subscribeChatChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(load, 400);
    });
    return () => {
      mounted = false;
      clearTimeout(timer);
      unsub();
    };
  }, [user]);

  const q = query.trim().toLowerCase();
  const visible = chats.filter((c) => {
    if (filter === "unread" && c.unread === 0) return false;
    if ((filter === "order" || filter === "leftover") && c.kind !== filter) return false;
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.subtitle.toLowerCase().includes(q) ||
      (c.last?.message || "").toLowerCase().includes(q)
    );
  });

  const FILTERS = [
    { id: "all", label: "Все" },
    ...(isAdmin ? [] : [{ id: "unread", label: "Непрочитанные" }]),
    { id: "order", label: "Заявки" },
    { id: "leftover", label: "Кубовик" },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600" />
          {t("Чаты")}
        </h1>
        <p className="text-sm text-neutral-500">
          {isAdmin
            ? t("Все переписки миксеристов и клиентов")
            : t("Переписка по вашим заказам и остаткам. Номера скрыты.")}
        </p>
      </div>

      {(isAdmin || chats.length > 5) && (
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Поиск по чатам")}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
          />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border",
              filter === f.id
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200"
            )}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            {chats.length === 0
              ? t("Чатов пока нет. Чат появляется, когда миксерист принял заказ или остаток перехвачен.")
              : t("Ничего не найдено")}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm divide-y divide-neutral-100 overflow-hidden">
          {visible.map((c) => {
            const Icon = c.kind === "leftover" ? Flame : Truck;
            const lastMine = c.last && c.last.sender_role === c.role;
            return (
              <button
                key={c.key}
                onClick={() => navigate(chatPath(c.kind, c.id))}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-neutral-50"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    c.kind === "leftover" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-700"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-neutral-900 truncate">{c.title}</span>
                    <span
                      className={cn(
                        "text-[11px] shrink-0",
                        c.unread > 0 ? "text-green-600 font-bold" : "text-neutral-400"
                      )}
                    >
                      {fmtWhen(c.last?.created_at)}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">{c.subtitle}</div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-sm text-neutral-600 truncate flex items-center gap-1">
                      {lastMine &&
                        (c.last.read_at ? (
                          <CheckCheck className="w-4 h-4 text-sky-500 shrink-0" />
                        ) : (
                          <Check className="w-4 h-4 text-neutral-400 shrink-0" />
                        ))}
                      {c.last ? (
                        <span className="truncate">
                          {isAdmin && c.last.sender_name ? `${c.last.sender_name}: ` : ""}
                          {displayText(c.last.message, c.role)}
                        </span>
                      ) : (
                        <span className="italic text-neutral-400">{t("Напишите первым")}</span>
                      )}
                    </span>
                    {c.unread > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-green-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
