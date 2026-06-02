import { CAR_COLORS, TRUCK_COLORS } from "./constants";

export function getVehicleColor(type, id) {
  const palette = type === "truck" ? TRUCK_COLORS : CAR_COLORS;
  return palette[id % palette.length];
}

export function formatTime(totalHours) {
  const day = Math.floor(totalHours / 24) + 1;
  const hour = totalHours % 24;
  return `День ${day} · ${String(hour).padStart(2, "0")}:00`;
}

export function getStatusText(status) {
  if (status === "waiting") return "ждет";
  if (status === "parking") return "заезжает";
  if (status === "parked") return "припаркована";
  if (status === "left") return "уехала";
  return "";
}
