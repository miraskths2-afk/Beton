// Смена роли самим пользователем (экран «Кто вы?» по ссылке
// /choose-role?change=1).
//
// Админ и завод роль не меняют: админ назначается только в самой базе,
// заводы заводит диспетчер. Остальные могут выбрать роль заново:
// - заказчик, как и при обычной регистрации, сразу получает доступ;
// - водитель и насосник снова ждут одобрения диспетчера (даже если
//   раньше уже были одобрены в другой роли).

export const CHANGE_ROLE_PATH = "/choose-role?change=1";

export const canChangeRole = (user) =>
  !!user && user.role !== "admin" && user.account_type !== "plant";

export const roleChangeFields = (role) => {
  if (role === "client") {
    return { account_type: "client", approval_status: "approved" };
  }
  return {
    account_type: role,
    equipment_type: role === "pump" ? "pump" : "mixer",
    approval_status: "pending",
  };
};
