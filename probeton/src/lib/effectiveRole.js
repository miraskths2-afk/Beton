// Определяет, какой интерфейс показывать сейчас.
// Для админа учитывает выбранный им режим просмотра (viewMode) —
// это позволяет администратору переключаться и видеть приложение
// глазами заказчика или водителя, не меняя свою настоящую роль в базе.
export function getEffectiveRole(user, viewMode) {
  if (user?.role === "admin") return viewMode || "admin";
  if (user?.account_type === "driver") return "driver";
  return "client";
}
