import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Loader2, Clock, CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestTopup, formatTenge } from "@/lib/balance";

const QUICK_AMOUNTS = [5000, 10000, 20000];

const TOPUP_STATUS = {
  pending: { label: "На проверке", icon: Clock, cls: "text-amber-600" },
  confirmed: { label: "Зачислено", icon: CheckCircle2, cls: "text-green-600" },
  rejected: { label: "Отклонено", icon: XCircle, cls: "text-red-600" },
};

const fmtDate = (d) =>
  new Date(d).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Баланс водителя: сколько денег на счёте, пополнение через Kaspi
// (диспетчер подтверждает приход) и история списаний.
export default function DriverWallet({ wallet }) {
  const { balance, settings, topups, transactions, reload } = wallet;
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value < 500) {
      setError("Минимальная сумма пополнения — 500 ₸");
      return;
    }
    setSending(true);
    setError("");
    setMessage("");
    try {
      await requestTopup(value);
      setAmount("");
      setMessage("Заявка отправлена. Деньги появятся на балансе, как только диспетчер увидит перевод.");
      reload();
    } catch (err) {
      setError(err?.message || "Не удалось отправить заявку");
    } finally {
      setSending(false);
    }
  };

  const fee = Number(settings?.leftover_post_fee || 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 shadow-md">
        <div className="flex items-center gap-2 text-orange-100 text-sm">
          <Wallet className="w-4 h-4" />
          Баланс
        </div>
        <div className="text-4xl font-black mt-2 tabular-nums">
          {balance == null ? "…" : formatTenge(balance)}
        </div>
        {fee > 0 && (
          <div className="text-xs text-orange-100 mt-2">
            Публикация остатка в{" "}
            <Link to="/kubovik" className="underline font-semibold">
              Кубовике
            </Link>{" "}
            — {formatTenge(fee)}
            {balance != null && ` · хватит на ${Math.floor(balance / fee)}`}
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3"
      >
        <div className="font-bold text-neutral-900">Пополнить баланс</div>
        <ol className="text-xs text-neutral-600 space-y-1 list-decimal pl-4">
          <li>
            Переведите сумму: <b>{settings?.kaspi_details || "реквизиты уточните у диспетчера"}</b>
          </li>
          <li>Укажите ту же сумму ниже и нажмите «Я перевёл».</li>
          <li>Диспетчер проверит перевод и зачислит деньги.</li>
        </ol>
        <div className="flex gap-2">
          {QUICK_AMOUNTS.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setAmount(String(v))}
              className="flex-1 text-xs font-semibold border border-neutral-200 rounded-lg py-2 hover:bg-neutral-50"
            >
              {formatTenge(v)}
            </button>
          ))}
        </div>
        <Input
          type="number"
          min="500"
          step="100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Сумма, ₸"
          className="h-11 rounded-xl"
        />
        {error && <div className="text-xs font-semibold text-red-600">{error}</div>}
        {message && <div className="text-xs font-semibold text-green-700">{message}</div>}
        <Button
          type="submit"
          disabled={sending}
          className="w-full h-11 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Я перевёл"}
        </Button>
      </form>

      {topups.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
            Заявки на пополнение
          </div>
          {topups.map((t) => {
            const st = TOPUP_STATUS[t.status] || TOPUP_STATUS.pending;
            const Icon = st.icon;
            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-neutral-200 p-3 flex items-center justify-between"
              >
                <div className={`flex items-center gap-2 text-sm font-semibold ${st.cls}`}>
                  <Icon className="w-4 h-4" />
                  {st.label}
                </div>
                <div className="text-right">
                  <div className="text-sm font-black tabular-nums">{formatTenge(t.amount)}</div>
                  <div className="text-[11px] text-neutral-400">{fmtDate(t.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide px-1">
            Движение по балансу
          </div>
          {transactions.map((tx) => {
            const plus = Number(tx.amount) > 0;
            return (
              <div
                key={tx.id}
                className="bg-white rounded-xl border border-neutral-200 p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {plus ? (
                    <ArrowDownLeft className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-neutral-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-neutral-800 truncate">{tx.note || tx.kind}</div>
                    <div className="text-[11px] text-neutral-400">{fmtDate(tx.created_at)}</div>
                  </div>
                </div>
                <div
                  className={`text-sm font-black tabular-nums ${plus ? "text-green-600" : "text-neutral-900"}`}
                >
                  {plus ? "+" : ""}
                  {formatTenge(tx.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
