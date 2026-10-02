import L from "leaflet";

// Значок на карте: миксер 🚚 или насос АБН 🏗️.
export const vehicleIcon = (highlighted, isPump = false) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${
      highlighted ? "#f59e0b" : isPump ? "#0ea5e9" : "#22c55e"
    };width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #171717;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:16px">${
      isPump ? "🏗️" : "🚚"
    }</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
