import type { Device } from "./device-data";

export const isSensor = (device: Device) => ["dht_sensor", "gas_sensor", "fire_sensor"].includes(device.deviceType);
export const metricName = (metric: string) => ({ temperature: "Nhiệt độ", humidity: "Độ ẩm", gas: "Nồng độ gas" })[metric] ?? metric;
export function filterDevices(items: Device[], search: string, room: string | null, status: string) {
  const query = search.trim().toLocaleLowerCase("vi");
  return items.filter(device => (!query || `${device.name} ${device.room ?? ""}`.toLocaleLowerCase("vi").includes(query))
    && (room === null || (device.room ?? "Chưa phân phòng") === room)
    && (status === "Tất cả" || device.isOnline === (status === "Trực tuyến")));
}
