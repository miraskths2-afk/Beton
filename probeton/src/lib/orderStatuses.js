export const ORDER_STATUSES = {
  new: { label: "Поиск машины", cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "В работе", cls: "bg-amber-100 text-amber-700" },
  sent_to_plant: { label: "Передано на завод", cls: "bg-purple-100 text-purple-700" },
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
