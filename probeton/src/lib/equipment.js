// Виды техники миксериста. Ключ хранится в app_users.equipment_type.
export const EQUIPMENT = {
  mixer: "Миксер (АБС)",
  pump_16: "АБН 16м",
  pump_24: "АБН 24м",
  pump_36: "АБН 36м",
  pump_52: "АБН 52м",
};

// Миксерист при регистрации обязательно указывает данные своей техники.
export const needsVehicleInfo = (user) =>
  user?.account_type === "driver" &&
  user?.role !== "admin" &&
  (!user?.vehicle_plate || !user?.equipment_type);
