import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/api/base44Client";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import VoiceInputButton, { appendSpoken } from "@/components/VoiceInputButton";
import { t, locale } from "@/lib/i18n";

const ROLE_LABEL = {
  client: "Заказчик",
  driver: "Миксерист",
  admin: "Диспетчер",
};

export default function OrderChat({ orderId, myRole, myName }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`realtime:order_messages:${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
     
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setText("");
    try {
      await supabase.from("order_messages").insert({
        order_id: orderId,
        sender_role: myRole,
        sender_name: myName,
        message: trimmed,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-neutral-500" />
        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
          {t("Чат по заказу")}
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center py-6 text-neutral-400">
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-neutral-400">
            {t("Сообщений пока нет — напишите первым")}
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_role === myRole;
            return (
              <div
                key={m.id}
                className={cn("flex", isMine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    isMine
                      ? "bg-neutral-900 text-white rounded-br-sm"
                      : "bg-neutral-100 text-neutral-800 rounded-bl-sm"
                  )}
                >
                  {!isMine && (
                    <div className="text-[10px] font-bold opacity-60 mb-0.5">
                      {m.sender_name || t(ROLE_LABEL[m.sender_role]) || m.sender_role}
                    </div>
                  )}
                  <div>{m.message}</div>
                  <div
                    className={cn(
                      "text-[10px] mt-0.5",
                      isMine ? "text-neutral-300" : "text-neutral-400"
                    )}
                  >
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 p-3 border-t border-neutral-100">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("Написать сообщение...")}
          className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
        />
        <VoiceInputButton
          className="w-9 h-9 rounded-lg"
          onText={(txt) => setText((prev) => appendSpoken(prev, txt))}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-3 py-2 rounded-lg bg-neutral-900 text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
