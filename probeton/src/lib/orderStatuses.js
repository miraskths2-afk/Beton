export const ORDER_STATUSES = {
  new: { label: "Поиск машины", cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "В работе", cls: "bg-amber-100 text-amber-700" },
  sent_to_plant: { label: "Назначен миксер", cls: "bg-purple-100 text-purple-700" },
  manufacturing: { label: "Бетон изготавливается", cls: "bg-orange-100 text-orange-700" },
  en_route: { label: "Машина в пути", cls: "bg-green-100 text-green-700" },
  done: { label: "Готов", cls: "bg-neutral-200 text-neutral-700" },
  cancelled: { label: "Отменён клиентом", cls: "bg-red-100 text-red-700" },
};

export const STATUS_FLOW = [
  "new",
  "in_progress",
  "sent_to_plant",
  "manufacturing",
  "en_route",
  "done",
];

export const normPhone = (p) => (p || "").replace(/\D/g, "").slice(-10);

// Заказчик может сам отменить заказ, только пока бетон ещё не начали
// готовить и никто не приехал и не платил. Дальше отмена — только через
// диспетчера, иначе можно было бы отменить уже привезённый заказ и не платить.
export const CLIENT_CANCELLABLE = ["new", "in_progress"];
export const canClientCancel = (o) =>
  CLIENT_CANCELLABLE.includes(o?.status || "new") &&
  !o?.arrived_at &&
  !o?.unloaded_at &&
  !o?.driver_paid &&
  !o?.client_paid &&
  !o?.commission_paid &&
  !o?.pump_prepaid;

// Корень заявки: рейсы нескольких миксеров и АБН к бетону — это отдельные
// строки orders, но для заказчика это один заказ.
export const orderGroupRoot = (o) => o?.parent_order_id || o?.pump_for_order_id || o?.id;

// Подпись статуса с учётом типа заявки: у заявки АБН вместо «миксера» —
// «насос». Используйте её вместо ORDER_STATUSES[...].label в карточках.
const PUMP_STATUS_LABELS = {
  new: "Поиск насоса",
  sent_to_plant: "Назначен насос",
  en_route: "Насос в пути",
};
export function statusLabel(o) {
  const s = o?.status || "new";
  if (o?.service_type === "pump" && PUMP_STATUS_LABELS[s]) return PUMP_STATUS_LABELS[s];
  return ORDER_STATUSES[s]?.label || s;
}

// Шаги для полоски статусов: у АБН нет «Бетон изготавливается».
export function statusFlowFor(o) {
  return o?.service_type === "pump"
    ? STATUS_FLOW.filter((s) => s !== "manufacturing")
    : STATUS_FLOW;
}
