import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { normPhone } from "@/lib/orderStatuses";
import {
  ArrowLeft,
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Info,
  Loader2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import VoiceInputButton, { appendSpoken } from "@/components/VoiceInputButton";
import {
  CHAT_TABLE,
  ROLE_LABEL,
  chatColumn,
  getChatRole,
  displayText,
  sendChatMessage,
  markChatRead,
} from "@/lib/chat";
import { t, locale } from "@/lib/i18n";

const QUICK_REPLIES = {
  driver: ["Выезжаю", "Буду через 10 минут", "Я на месте", "Куда подъехать для разгрузки?"],
  client: ["Где вы сейчас?", "Жду на объекте", "Подъезд свободен", "Спасибо!"],
  plant: ["Миксер выехал", "Уточните адрес, пожалуйста"],
};

const ROLE_COLOR = {
  client: "text-blue-600",
  driver: "text-green-700",
  admin: "text-purple-600",
  plant: "text-orange-600",
};

function dayLabel(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t("Сегодня");
  if (date.toDateString() === yesterday.toDateString()) return t("Вчера");
  return date.toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

export default function ChatPage() {
  const { kind: rawKind, id } = useParams();
  const kind = rawKind === "leftover" ? "leftover" : "order";
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const [peer, setPeer] = useState(null);
  const [peerTyping, setPeerTyping] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const typingChannelRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const typingTimerRef = useRef(null);
  const firstScrollRef = useRef(true);

  const role = getChatRole(user, kind, item);
  const isAdmin = role === "admin";
  const col = chatColumn(kind);

  // Заказ / остаток
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const entity = kind === "leftover" ? base44.entities.Leftover : base44.entities.Order;
    entity
      .get(id)
      .then((data) => mounted && setItem(data || null))
      .catch((e) => console.error(e))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [kind, id]);

  // Собеседник: только имя и фото, без номера телефона.
  useEffect(() => {
    if (!item || !role || role === "admin") {
      setPeer(null);
      return undefined;
    }
    let mounted = true;
    const load = async () => {
      if (role === "client") {
        if (!item.driver_id) return;
        const { data } = await supabase
          .from("app_users")
          .select("full_name, driver_name, photo_url")
          .eq("id", item.driver_id)
          .maybeSingle();
        if (mounted)
          setPeer({
            name: data?.full_name || data?.driver_name || item.driver_name || t("Миксерист"),
            photo: data?.photo_url || null,
            role: "driver",
          });
        return;
      }
      const clientPhone = normPhone(kind === "leftover" ? item.intercepted_by_phone : item.phone);
      let name = null;
      if (clientPhone) {
        const { data } = await supabase
          .from("app_users")
          .select("full_name, photo_url")
          .like("phone", `%${clientPhone}`)
          .limit(1);
        name = data?.[0]?.full_name || null;
      }
      if (mounted)
        setPeer({
          name: name || (kind === "leftover" ? t("Прораб") : t("Заказчик")),
          photo: null,
          role: "client",
        });
    };
    load();
    return () => {
      mounted = false;
    };
  }, [item, role, kind]);

  // Сообщения + живое обновление
  useEffect(() => {
    if (!role) return undefined;
    let mounted = true;
    supabase
      .from(CHAT_TABLE)
      .select("*")
      .eq(col, id)
      .order("created_at", { ascending: true })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) console.error(error);
        if (mounted) setMessages(data || []);
      });
    markChatRead(kind, id, role);

    const channel = supabase
      .channel(`chat:${kind}:${id}:${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CHAT_TABLE, filter: `${col}=eq.${id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old?.id));
            return;
          }
          const m = payload.new;
          if (!m?.id) return;
          setMessages((prev) => {
            const idx = prev.findIndex((x) => x.id === m.id);
            if (idx === -1) return [...prev, m];
            const next = [...prev];
            next[idx] = m;
            return next;
          });
          if (
            payload.eventType === "INSERT" &&
            m.sender_role !== role &&
            document.visibilityState === "visible"
          ) {
            setPeerTyping(false);
            markChatRead(kind, id, role);
          }
        }
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") markChatRead(kind, id, role);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [kind, id, col, role]);

  // «Печатает…» — через широковещательный канал, в базу ничего не пишем.
  useEffect(() => {
    if (!role) return undefined;
    const channel = supabase.channel(`typing:${kind}:${id}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.role === role || payload.role === "admin") return;
        setPeerTyping(true);
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setPeerTyping(false), 3500);
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      clearTimeout(typingTimerRef.current);
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [kind, id, role]);

  const all = [...messages, ...pending];

  // Прокрутка вниз: сразу при открытии и при новых сообщениях, если
  // пользователь и так внизу (или это его собственное сообщение).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || all.length === 0) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    const lastMine = all[all.length - 1]?.sender_role === role;
    if (firstScrollRef.current || nearBottom || lastMine) {
      el.scrollTop = el.scrollHeight;
      firstScrollRef.current = false;
    }
  }, [all.length, role]);

  // Высота поля ввода растёт вместе с текстом (до ~5 строк).
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);

  const myName =
    role === "admin"
      ? "Диспетчер"
      : user?.full_name || t(ROLE_LABEL[role] || "Пользователь");

  const deliver = useCallback(
    async (temp) => {
      setPending((prev) =>
        prev.map((p) => (p.id === temp.id ? { ...p, failed: false } : p))
      );
      try {
        const saved = await sendChatMessage({
          kind,
          id,
          user,
          role,
          name: myName,
          message: temp.message,
        });
        setPending((prev) => prev.filter((p) => p.id !== temp.id));
        setMessages((prev) =>
          prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]
        );
      } catch (e) {
        console.error(e);
        setPending((prev) =>
          prev.map((p) => (p.id === temp.id ? { ...p, failed: true } : p))
        );
      }
    },
    [kind, id, user, role, myName]
  );

  const sendText = (raw) => {
    const message = (raw || "").trim();
    if (!message || !role) return;
    const temp = {
      id: `tmp-${Date.now()}-${Math.random()}`,
      message,
      sender_role: role,
      sender_name: myName,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setPending((prev) => [...prev, temp]);
    deliver(temp);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendText(text);
    setText("");
    textareaRef.current?.focus();
  };

  const onKeyDown = (e) => {
    // Enter — отправить, Shift+Enter — новая строка (как в WhatsApp Web).
    // На телефоне Enter на клавиатуре тоже отправляет — это удобнее в машине.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      onSubmit(e);
    }
  };

  const onChangeText = (value) => {
    setText(value);
    const now = Date.now();
    if (value && typingChannelRef.current && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { role },
      });
    }
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/chats");
  };

  const detailsPath = kind === "leftover" ? `/leftover/${id}` : `/order/${id}`;

  // ===== Экраны загрузки / нет доступа =====
  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!item || !role) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center">
        <MessageCircle className="w-10 h-10 text-neutral-300" />
        <p className="text-sm text-neutral-500">
          {!item ? t("Чат не найден") : t("Этот чат доступен только участникам заказа")}
        </p>
        <button onClick={() => navigate("/chats")} className="text-sm font-bold underline">
          {t("К списку чатов")}
        </button>
      </div>
    );
  }

  const cubes = item.cubes ? t("{n} куб", { n: item.cubes }) : "";
  const about =
    kind === "leftover"
      ? [t("Кубовик"), item.grade, cubes].filter(Boolean).join(" · ")
      : [
          item.order_number ? `${t("Заказ")} №${item.order_number}` : t("Заказ"),
          item.grade,
          cubes,
        ]
          .filter(Boolean)
          .join(" · ");

  const title = isAdmin
    ? `${item.driver_name || t("Миксерист")} ↔ ${kind === "leftover" ? t("Прораб") : t("Заказчик")}`
    : peer?.name || "…";

  const isClosed =
    kind === "leftover"
      ? item.status === "gone"
      : item.status === "done" || item.status === "cancelled";

  const quick = !isAdmin && !text ? QUICK_REPLIES[role] || [] : [];

  let lastDay = null;

  return (
    <div className="h-[100dvh] flex flex-col max-w-md mx-auto bg-neutral-50">
      {/* Шапка как в мессенджере */}
      <header className="app-header bg-neutral-900 text-white px-2 py-2.5 flex items-center gap-2 shadow-sm shrink-0">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label={t("Назад")}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {peer?.photo ? (
          <img src={peer.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-amber-400 text-neutral-900 flex items-center justify-center font-black">
            {(isAdmin ? "Ч" : (peer?.name || "?").trim().charAt(0) || "?").toUpperCase()}
          </div>
        )}
        <button
          onClick={() => navigate(detailsPath)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="font-bold text-[15px] leading-tight truncate">{title}</div>
          <div className="text-[11px] text-neutral-400 truncate">
            {peerTyping ? (
              <span className="text-green-400 font-semibold">{t("печатает…")}</span>
            ) : (
              about
            )}
          </div>
        </button>
        <button
          onClick={() => navigate(detailsPath)}
          className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label={t("Подробнее")}
        >
          <Info className="w-5 h-5" />
        </button>
      </header>

      {/* Лента сообщений */}
      <div
        ref={scrollRef}
        data-no-pull
        className="chat-wallpaper flex-1 overflow-y-auto px-3 py-3 space-y-1"
      >
        <div className="flex justify-center mb-2">
          <div className="chat-notice max-w-[90%] text-[11px] text-center rounded-lg px-3 py-1.5 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              {isAdmin
                ? t("Вы просматриваете переписку как диспетчер. Ваши сообщения увидят обе стороны.")
                : t("Номера телефонов скрыты. Общайтесь здесь — диспетчер видит переписку и поможет при споре.")}
            </span>
          </div>
        </div>

        {all.length === 0 && (
          <div className="text-center text-xs chat-meta py-10">
            {t("Сообщений пока нет — напишите первым")}
          </div>
        )}

        {all.map((m) => {
          const day = new Date(m.created_at).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.sender_role === role;
          const showName = !mine && (isAdmin || m.sender_role === "admin" || m.sender_role === "plant");
          return (
            <React.Fragment key={m.id}>
              {showDay && (
                <div className="flex justify-center py-2">
                  <span className="chat-notice text-[11px] font-semibold rounded-lg px-2.5 py-1">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "relative max-w-[82%] rounded-lg px-2.5 pt-1.5 pb-1 shadow-sm text-[15px] leading-snug",
                    mine ? "chat-bubble-mine rounded-tr-sm" : "chat-bubble-other rounded-tl-sm"
                  )}
                >
                  {showName && (
                    <div className={cn("text-xs font-bold mb-0.5", ROLE_COLOR[m.sender_role])}>
                      {m.sender_role === "admin"
                        ? t("Диспетчер")
                        : `${m.sender_name || t(ROLE_LABEL[m.sender_role] || "")} · ${t(ROLE_LABEL[m.sender_role] || "")}`}
                    </div>
                  )}
                  <span className="whitespace-pre-wrap break-words">
                    {displayText(m.message, role)}
                  </span>
                  <span className="inline-flex items-center gap-0.5 float-right ml-2 mt-1.5 text-[10px] chat-meta translate-y-0.5">
                    {fmtTime(m.created_at)}
                    {mine &&
                      (m.failed ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      ) : m.pending ? (
                        <Clock className="w-3 h-3" />
                      ) : m.read_at ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      ))}
                  </span>
                  {m.failed && (
                    <button
                      onClick={() => deliver(m)}
                      className="block clear-both text-[11px] font-bold text-red-600 underline mt-0.5"
                    >
                      {t("Не отправлено — повторить")}
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {isClosed && (
        <div className="text-center text-[11px] text-neutral-500 bg-neutral-100 py-1.5 shrink-0">
          {kind === "leftover" ? t("Остаток уже завершён") : t("Заказ уже завершён")}
        </div>
      )}

      {/* Быстрые ответы */}
      {quick.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 py-2 bg-neutral-50 shrink-0 border-t border-neutral-200">
          {quick.map((q) => (
            <button
              key={q}
              onClick={() => sendText(t(q))}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            >
              {t(q)}
            </button>
          ))}
        </div>
      )}

      {/* Поле ввода */}
      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 px-2 pt-2 bg-neutral-50 shrink-0 border-t border-neutral-200"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex-1 flex items-end gap-1 bg-white rounded-3xl border border-neutral-200 pl-4 pr-1 py-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("Сообщение")}
            className="flex-1 resize-none bg-transparent py-2 text-[15px] leading-5 focus:outline-none max-h-[120px]"
          />
          <VoiceInputButton
            className="w-9 h-9 rounded-full shrink-0"
            onText={(txt) => setText((prev) => appendSpoken(prev, txt))}
          />
        </div>
        <button
          type="submit"
          disabled={!text.trim()}
          className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label={t("Отправить")}
        >
          <Send className="w-5 h-5 -ml-0.5" />
        </button>
      </form>
    </div>
  );
}
