import type { ParsedTimestamp } from "../../../domain/import/import";
import { ImportParseError } from "../../../domain/import/parser";
export function parseMt5Timestamp(raw: string, timeZone: string): ParsedTimestamp {
  try { Intl.DateTimeFormat("en-US", { timeZone }); }
  catch { throw new ImportParseError("INVALID_TIMEZONE", "Invalid account IANA timezone."); }
  const match = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) throw new ImportParseError("INVALID_TIMESTAMP", "Invalid MT5 timestamp.");
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  const probe = new Date(desired);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day ||
      hour > 23 || minute > 59 || second > 59) {
    throw new ImportParseError("INVALID_TIMESTAMP", "The timestamp contains a non-existent date.");
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let epochMs = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(epochMs))
      .filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const delta = desired - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    epochMs += delta;
    if (delta === 0) break;
  }
  const actual = Object.fromEntries(formatter.formatToParts(new Date(epochMs))
    .filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  if (actual.year !== year || actual.month !== month || actual.day !== day || actual.hour !== hour ||
      actual.minute !== minute || actual.second !== second) {
    throw new ImportParseError("INVALID_TIMESTAMP", "The timestamp is invalid in the account timezone.");
  }
  return { original: raw.trim(), epochMs };
}
