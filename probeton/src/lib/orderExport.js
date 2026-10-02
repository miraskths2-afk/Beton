// Колонки для выгрузки заказов в CSV (для бухгалтерии).
import { ORDER_STATUSES } from "@/lib/orderStatuses";
import { t, locale } from "@/lib/i18n";
import { downloadCsv, todayStamp } from "@/lib/csv";

// Сервисный сбор — кубы × 1000 ₸ (так же считается в аналитике).
export const COMMISSION_PER_CUBE = 1000;

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString(locale(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const yesNo = (v) => (v ? t("да") : t("нет"));

export const ORDER_COLUMNS = [
  { label: "Номер", value: (o) => o.order_number },
  { label: "Создан", value: (o) => fmt(o.created_date) },
  {
    label: "Статус",
    value: (o) => t(ORDER_STATUSES[o.status || "new"]?.label || o.status),
  },
  { label: "Марка", value: (o) => o.grade },
  { label: "Кубов", value: (o) => o.cubes },
  { label: "Адрес", value: (o) => o.delivery_address },
  { label: "Телефон клиента", value: (o) => o.phone },
  { label: "Водитель", value: (o) => o.driver_name },
  { label: "Нужен к", value: (o) => fmt(o.needed_by) },
  { label: "Принят", value: (o) => fmt(o.accepted_at) },
  { label: "Выполнен", value: (o) => fmt(o.completed_at) },
  { label: "Сумма, ₸", value: (o) => o.total },
  {
    label: "Сервисный сбор, ₸",
    value: (o) => (o.cubes ? o.cubes * COMMISSION_PER_CUBE : ""),
  },
  { label: "Клиент оплатил сбор", value: (o) => yesNo(o.commission_paid) },
  { label: "Водитель оплатил", value: (o) => yesNo(o.driver_payment_confirmed) },
  { label: "Оценка клиента", value: (o) => o.client_rating },
  { label: "Оценка водителя", value: (o) => o.driver_rating },
  { label: "Комментарий", value: (o) => o.comment },
];

export function exportOrdersCsv(orders, name = "zakazy") {
  const columns = ORDER_COLUMNS.map((c) => ({ ...c, label: t(c.label) }));
  downloadCsv(`probeton-${name}-${todayStamp()}.csv`, columns, orders);
}
