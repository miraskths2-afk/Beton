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
  Mic,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useVoiceRecorder,
  VoiceBubble,
  canRecordVoice,
  fmtDuration,
  MAX_VOICE_SECONDS,
} from "@/components/ChatVoice";
import {
  CHAT_TABLE,
  ROLE_LABEL,
  chatColumn,
  getChatRole,
  displayText,
  sendChatMessage,
  markChatRead,
  uploadVoice,
  VOICE_LABEL,
  deleteChatMessage,
  deleteChatThread,
  filterChat,
  messageInChat,
  isChatClosed,
  chatDetailsPath,
} from "@/lib/chat";
import { t, locale } from "@/lib/i18n";

// Быстрые команды — как в Яндекс Такси: одно нажатие, и собеседник
// видит понятный статус. «Задерживаюсь» сначала спрашивает, на сколько.
const DELAYS = [10, 20, 30, 60];
const QUICK_COMMANDS = {
  driver: [
    { emoji: "🚚", label: "Еду" },
    { emoji: "⏱", label: "Задерживаюсь", delay: true },
    { emoji: "📍", label: "Приехал" },
    { emoji: "🏭", label: "Загружаюсь на заводе" },
    { emoji: "🔄", label: "Начал выгрузку" },
    { emoji: "✅", label: "Выгрузил" },
    { emoji: "❓", label: "Куда подъехать?" },
  ],
  client: [
    { emoji: "👍", label: "Жду" },
    { emoji: "📍", label: "Где вы сейчас?" },
    { emoji: "🚧", label: "Подъезд свободен" },
    { emoji: "⏱", label: "Задержусь", delay: true },
    { emoji: "🙏", label: "Спасибо!" },
  ],
  plant: [
    { emoji: "🚚", label: "Миксер выехал" },
    { emoji: "⏱", label: "Задерживаемся", delay: true },
    { emoji: "❓", label: "Уточните адрес, пожалуйста" },
  ],
};

function commandText(cmd, minutes) {
  const base = `${cmd.emoji} ${t(cmd.label)}`;
  return minutes ? `${base} ${t("на {n} мин", { n: minutes })}` : base;
}

// Сообщение, отправленное быстрой командой, выделяем жирным.
const COMMAND_EMOJIS = ["🚚", "⏱", "📍", "🏭", "🔄", "✅", "❓", "👍", "🚧", "🙏"];
const isCommandMessage = (m) =>
  !m.audio_url && COMMAND_EMOJIS.some((e) => (m.message || "").startsWith(e + " "));

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
  const kind = ["order", "plant", "leftover"].includes(rawKind) ? rawKind : "order";
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const [peer, setPeer] = useState(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [delayCmd, setDelayCmd] = useState(null);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const typingChannelRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const typingTimerRef = useRef(null);
  const firstScrollRef = useRef(true);
  const recorder = useVoiceRecorder();
  const [voiceSupported] = useState(() => canRecordVoice());

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
      if (role === "client" && kind === "plant") {
        if (!item.plant_id) return;
        const { data } = await supabase
          .from("app_users")
          .select("plant_name, full_name, photo_url")
          .eq("id", item.plant_id)
          .maybeSingle();
        if (mounted)
          setPeer({
            name: data?.plant_name || item.plant_name || data?.full_name || t("Завод"),
            photo: data?.photo_url || null,
            role: "plant",
          });
        return;
      }
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
    filterChat(supabase.from(CHAT_TABLE).select("*"), kind, id)
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
          // У заявки два чата (с миксеристом и с заводом) — берём только свой.
          if (!m?.id || !messageInChat(m, kind)) return;
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

  // Голосовое ограничено по длине — по достижении лимита отправляем.
  useEffect(() => {
    if (recorder.recording && recorder.seconds >= MAX_VOICE_SECONDS) finishVoice();
  }, [recorder.recording, recorder.seconds]);

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
        let audioUrl = temp.uploadedUrl || null;
        if (temp.blob && !audioUrl) {
          audioUrl = await uploadVoice(temp.blob, kind, id);
          // Если сохранение сообщения не удастся — при повторе файл
          // заново не загружаем.
          temp.uploadedUrl = audioUrl;
        }
        const saved = await sendChatMessage({
          kind,
          id,
          user,
          role,
          name: myName,
          message: temp.message,
          audioUrl,
          audioDuration: temp.audio_duration,
        });
        setPending((prev) => prev.filter((p) => p.id !== temp.id));
        setMessages((prev) =>
          prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]
        );
      } catch (e) {
        console.error(e);
        setPending((prev) =>
          prev.map((p) =>
            p.id === temp.id ? { ...p, failed: true, uploadedUrl: temp.uploadedUrl } : p
          )
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

  const startVoice = async () => {
    try {
      await recorder.start();
    } catch (e) {
      console.error(e);
      alert(
        t("Нет доступа к микрофону. Разрешите микрофон для этого сайта в настройках браузера.")
      );
    }
  };

  const finishVoice = async () => {
    const res = await recorder.stop();
    if (!res || res.duration < 0.7) return; // случайное нажатие
    const temp = {
      id: `tmp-${Date.now()}-${Math.random()}`,
      message: VOICE_LABEL,
      audio_url: URL.createObjectURL(res.blob),
      audio_duration: Math.round(res.duration * 10) / 10,
      blob: res.blob,
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

  const detailsPath = chatDetailsPath(kind, id);

  // Админ может удалять сообщения и всю переписку, чтобы история не
  // забивалась. Собеседники ничего не удаляют.
  const removeMessage = async (m) => {
    if (!confirm(t("Удалить это сообщение? Его не увидит никто."))) return;
    try {
      await deleteChatMessage(m);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e) {
      alert(e?.message || t("Не удалось удалить"));
    }
  };

  const removeThread = async () => {
    if (!confirm(t("Удалить всю переписку в этом чате? Сам заказ останется, удалятся только сообщения."))) return;
    try {
      await deleteChatThread(kind, id);
      setMessages([]);
      navigate("/chats");
    } catch (e) {
      alert(e?.message || t("Не удалось удалить"));
    }
  };

  // ===== Экраны загрузки / нет доступа =====
  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // Сделка завершена — у участников чат закрыт, история остаётся у диспетчера.
  if (item && role && role !== "admin" && isChatClosed(kind, item)) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center">
        <MessageCircle className="w-10 h-10 text-neutral-300" />
        <p className="text-sm text-neutral-500">
          {t("Сделка завершена — чат закрыт. Если нужна помощь, напишите диспетчеру.")}
        </p>
        <button onClick={() => navigate("/chats")} className="text-sm font-bold underline">
          {t("К списку чатов")}
        </button>
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
    ? `${
        kind === "plant" ? item.plant_name || t("Завод") : item.driver_name || t("Миксерист")
      } ↔ ${kind === "leftover" ? t("Прораб") : t("Заказчик")}`
    : peer?.name || "…";

  const isClosed =
    kind === "leftover"
      ? item.status === "gone"
      : item.status === "done" || item.status === "cancelled";

  const quick = !isAdmin && !text && !recorder.recording ? QUICK_COMMANDS[role] || [] : [];

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
        {isAdmin && messages.length > 0 && (
          <button
            onClick={removeThread}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-red-300"
            aria-label={t("Удалить переписку")}
            title={t("Удалить переписку")}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
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
                  {m.audio_url ? (
                    <VoiceBubble src={m.audio_url} duration={m.audio_duration} mine={mine} />
                  ) : (
                    <span
                      className={cn(
                        "whitespace-pre-wrap break-words",
                        isCommandMessage(m) && "font-bold"
                      )}
                    >
                      {displayText(m.message, role)}
                    </span>
                  )}
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
                  {isAdmin && !m.pending && !m.failed && (
                    <button
                      onClick={() => removeMessage(m)}
                      className="float-right ml-1.5 mt-1 text-neutral-400 hover:text-red-600"
                      aria-label={t("Удалить сообщение")}
                      title={t("Удалить сообщение")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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

      {/* Быстрые команды */}
      {quick.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 py-2 bg-neutral-50 shrink-0 border-t border-neutral-200">
          {delayCmd ? (
            <>
              <button
                onClick={() => setDelayCmd(null)}
                className="shrink-0 text-xs font-bold px-3 py-2 rounded-full bg-neutral-200 text-neutral-700"
                aria-label={t("Назад")}
              >
                ←
              </button>
              <span className="shrink-0 self-center text-xs font-semibold text-neutral-500">
                {t("На сколько?")}
              </span>
              {DELAYS.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    sendText(commandText(delayCmd, n));
                    setDelayCmd(null);
                  }}
                  className="shrink-0 text-sm font-bold px-4 py-2 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                >
                  {t("{n} мин", { n })}
                </button>
              ))}
            </>
          ) : (
            quick.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => (cmd.delay ? setDelayCmd(cmd) : sendText(commandText(cmd)))}
                className="shrink-0 text-sm font-semibold px-3.5 py-2 rounded-full border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 inline-flex items-center gap-1.5"
              >
                <span>{cmd.emoji}</span>
                {t(cmd.label)}
              </button>
            ))
          )}
        </div>
      )}

      {/* Поле ввода */}
      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 px-2 pt-2 bg-neutral-50 shrink-0 border-t border-neutral-200"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {recorder.recording ? (
          <div className="flex-1 flex items-center gap-2 bg-white rounded-3xl border border-neutral-200 pl-1 pr-4 h-11">
            <button
              type="button"
              onClick={recorder.cancel}
              className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
              aria-label={t("Удалить запись")}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold tabular-nums">
              {fmtDuration(recorder.seconds)}
            </span>
            <span className="text-xs text-neutral-400 truncate">{t("Идёт запись…")}</span>
          </div>
        ) : (
          <div className="flex-1 flex items-end gap-1 bg-white rounded-3xl border border-neutral-200 pl-4 pr-3 py-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("Сообщение")}
              className="flex-1 resize-none bg-transparent py-2 text-[15px] leading-5 focus:outline-none max-h-[120px]"
            />
          </div>
        )}
        {recorder.recording ? (
          <button
            type="button"
            onClick={finishVoice}
            className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shrink-0"
            aria-label={t("Отправить голосовое")}
          >
            <Send className="w-5 h-5 -ml-0.5" />
          </button>
        ) : !text.trim() && voiceSupported ? (
          <button
            type="button"
            onClick={startVoice}
            className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shrink-0"
            aria-label={t("Записать голосовое")}
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!text.trim()}
            className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
            aria-label={t("Отправить")}
          >
            <Send className="w-5 h-5 -ml-0.5" />
          </button>
        )}
      </form>
    </div>
  );
}
