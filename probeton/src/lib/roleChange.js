// Смена роли самим пользователем (экран «Кто вы?» по ссылке
// /choose-role?change=1).
//
// Админ роль не меняет: он назначается только в самой базе.
// Остальные могут выбрать роль заново:
// - заказчик, как и при обычной регистрации, сразу получает доступ;
// - водитель, насосник и поставщик снова ждут одобрения диспетчера (даже если
//   раньше уже были одобрены в другой роли).

export const CHANGE_ROLE_PATH = "/choose-role?change=1";

export const canChangeRole = (user) =>
  !!user && user.role !== "admin";

export const roleChangeFields = (role) => {
  if (role === "client") {
    return { account_type: "client", approval_status: "approved" };
  }
  if (role === "supplier") {
    return { account_type: "supplier", equipment_type: null, approval_status: "pending" };
  }
  return {
    account_type: role,
    equipment_type: role === "pump" ? "pump" : "mixer",
    approval_status: "pending",
  };
};
