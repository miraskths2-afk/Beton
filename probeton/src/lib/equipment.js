// Вид техники исполнителя. Ключ хранится в app_users.equipment_type и
// определяется ролью: миксерист — миксер, насосник — АБН (длину стрелы
// насосник указывает отдельно, app_users.pump_boom).
export const EQUIPMENT = {
  mixer: "Миксер (АБС)",
  pump: "Автобетононасос (АБН)",
};

export const equipmentFor = (user) => (user?.account_type === "pump" ? "pump" : "mixer");

// Миксерист и насосник при регистрации обязательно указывают гос. номер,
// насосник — ещё и длину стрелы.
export const needsVehicleInfo = (user) =>
  user?.role !== "admin" &&
  ((user?.account_type === "driver" && !user?.vehicle_plate) ||
    (user?.account_type === "pump" && (!user?.vehicle_plate || !user?.pump_boom)));
