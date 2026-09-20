import React from "react";
import { Hourglass, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PendingScreen({ status, reapproval = false }) {
  const rejected = status === "rejected";
  return (
    <div className="p-5 flex flex-col items-center justify-center text-center min-h-[70vh]">
      <div
        className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mb-5",
          rejected ? "bg-red-100" : "bg-amber-100"
        )}
      >
        {rejected ? (
          <XCircle className="w-10 h-10 text-red-500" />
        ) : (
          <Hourglass className="w-10 h-10 text-amber-500 animate-pulse" />
        )}
      </div>
      <h1 className="text-xl font-black text-neutral-900">
        {rejected ? "Заявка отклонена" : "Ожидание одобрения"}
      </h1>
      <p className="text-sm text-neutral-500 mt-2 max-w-xs">
        {rejected
          ? "К сожалению, ваша заявка отклонена. Свяжитесь с диспетчером для уточнения."
          : reapproval
          ? "При повторном входе требуется подтверждение диспетчера. Как только вас одобрят, сайт снова станет доступен."
          : "Диспетчер рассматривает вашу заявку. Как только вас одобрят, здесь появится лента свободных заказов."}
      </p>
    </div>
  );
}
