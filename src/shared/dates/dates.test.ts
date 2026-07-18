import { describe, it, expect } from "vitest";
import { dateToEpochMs, epochMsToDate, formatDateOnly, parseDateOnly, formatToTimezone } from "./index";

describe("shared/dates", () => {
  it("should convert Date to Epoch Ms and back", () => {
    const date = new Date(Date.UTC(2026, 6, 18, 10, 0, 0));
    const ms = dateToEpochMs(date);
    expect(ms).toBe(date.getTime());
    
    const restored = epochMsToDate(ms);
    expect(restored.getTime()).toBe(date.getTime());
  });

  it("should format date to YYYY-MM-DD", () => {
    const date = new Date(Date.UTC(2026, 6, 18));
    const formatted = formatDateOnly(date);
    expect(formatted).toBe("2026-07-18");
  });

  it("should parse YYYY-MM-DD back to Date in UTC", () => {
    const dateStr = "2026-07-18";
    const date = parseDateOnly(dateStr);
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(6); // 0-indexed, July is 6
    expect(date.getUTCDate()).toBe(18);
  });

  it("should format epoch ms based on timezone string", () => {
    // 2026-07-18T10:00:00Z in epoch ms (UTC)
    const ms = Date.UTC(2026, 6, 18, 10, 0, 0);
    
    // London timezone should be 2026-07-18 11:00:00 (BST is UTC+1 in July)
    const londonFormatted = formatToTimezone(ms, "Europe/London");
    // Sử dụng match chứa giờ để đảm bảo độc lập với định dạng phân tách (ví dụ Intl.DateTimeFormat ở một số môi trường)
    expect(londonFormatted).toContain("11:00:00");

    // Saigon timezone should be 2026-07-18 17:00:00 (UTC+7)
    const saigonFormatted = formatToTimezone(ms, "Asia/Ho_Chi_Minh");
    expect(saigonFormatted).toContain("17:00:00");
  });
});
