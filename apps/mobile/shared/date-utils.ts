/**
 * Date and Time utilities for Smart Home Mobile app.
 * Configured explicitly for Vietnam Timezone (Asia/Ho_Chi_Minh, UTC+7).
 */

export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Format time in Vietnam timezone: "HH:mm" (e.g. "07:30")
 */
export function formatVnTime(date: string | number | Date): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Format date in Vietnam timezone: "DD/MM/YYYY" (e.g. "25/09/2026")
 */
export function formatVnDate(date: string | number | Date): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "--/--/----";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Format datetime in Vietnam timezone: "HH:mm DD/MM/YYYY"
 */
export function formatVnDateTime(date: string | number | Date): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "--:-- --/--/----";
  const time = formatVnTime(d);
  const dt = formatVnDate(d);
  return `${time} ${dt}`;
}

/**
 * Format relative time in Vietnamese, falling back to formatted VN date
 */
export function formatRelativeVnTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
