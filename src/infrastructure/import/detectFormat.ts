import { ImportParseError } from "../../domain/import/parser";
export function assertVantageMt5Csv(text: string): void {
  const head = text.slice(0, 100_000);
  if (/^\s*</.test(head) || /<html|<!doctype|<\?xml/i.test(head)) {
    throw new ImportParseError("UNSUPPORTED_HTML", "HTML/XML reports are not supported.");
  }
  const rows = head.split(/\r?\n/).filter((row) => row.trim());
  const positionIndex = rows.findIndex((row) => /^"?Positions"?\s*,?\s*$/i.test(row.trim()));
  const header = positionIndex >= 0 ? rows.slice(positionIndex + 1, positionIndex + 4).join(" ") : "";
  if (!/Trade History Report/i.test(rows[0] ?? "") || !rows.some((row) => /Account:/i.test(row)) ||
      positionIndex < 0 || !/Position|Ticket/i.test(header) || !/Symbol/i.test(header)) {
    throw new ImportParseError("UNSUPPORTED_FORMAT", "Not a supported Vantage MT5 Trade History CSV report.");
  }
}
