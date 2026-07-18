/**
 * Chuyển đổi Date sang Unix epoch milliseconds UTC
 */
export function dateToEpochMs(date: Date): number {
  return date.getTime();
}

/**
 * Tạo Date từ Unix epoch milliseconds UTC
 */
export function epochMsToDate(ms: number): Date {
  return new Date(ms);
}

/**
 * Format Date thành dạng YYYY-MM-DD (ngày không có giờ, theo UTC)
 */
export function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Phân tích chuỗi ngày YYYY-MM-DD thành Date (ở UTC để tránh lệch múi giờ local)
 */
export function parseDateOnly(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format, expected YYYY-MM-DD: ${dateStr}`);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date values: ${dateStr}`);
  }
  return date;
}

/**
 * Hiển thị thời gian epoch milliseconds UTC theo Timezone IANA được chỉ định
 */
export function formatToTimezone(ms: number, timezone: string): string {
  const date = new Date(ms);
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(date);
    const partMap = new Map(parts.map(p => [p.type, p.value]));
    
    const y = partMap.get('year');
    const m = partMap.get('month');
    const d = partMap.get('day');
    const hr = partMap.get('hour');
    const min = partMap.get('minute');
    const sec = partMap.get('second');
    
    return `${y}-${m}-${d} ${hr}:${min}:${sec}`;
  } catch (error) {
    // Fallback sang ISO-8601 UTC nếu timezone không hợp lệ
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }
}
export function dateToIsoString(date: Date): string {
  return date.toISOString();
}
