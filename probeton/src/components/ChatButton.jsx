import React from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatPath, previewText, useChatUnread, isChatClosed } from "@/lib/chat";
import { t } from "@/lib/i18n";

// Кнопка «Написать …» вместо номера телефона. Показывает число
// непрочитанных и последнее сообщение, по нажатию открывает чат.
// Если передан item (заказ/остаток) и сделка завершена — кнопку видит
// только админ: у участников чат пропадает.
export default function ChatButton({ kind, id, role, label, item, compact = false, className }) {
  const navigate = useNavigate();
  const { count, last } = useChatUnread(kind, id, role);

  if (item && role !== "admin" && isChatClosed(kind, item)) return null;

  const open = (e) => {
    e.stopPropagation();
    navigate(chatPath(kind, id));
  };

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "w-full flex items-center gap-2 rounded-lg text-left bg-green-600 hover:bg-green-700 text-white",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
        className
      )}
    >
      <MessageCircle className={compact ? "w-3.5 h-3.5 shrink-0" : "w-4 h-4 shrink-0"} />
      <span className="flex-1 min-w-0">
        <span className="block font-bold truncate">{label || t("Открыть чат")}</span>
        {!compact && last && (
          <span className="block text-[11px] text-green-100 truncate">
            {previewText(last, role)}
          </span>
        )}
      </span>
      {count > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-white text-green-700 text-[11px] font-black flex items-center justify-center">
          {count}
        </span>
      )}
      <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
    </button>
  );
}
