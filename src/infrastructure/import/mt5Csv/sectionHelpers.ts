import type { ImportIssue, ImportSection, ParsedTimestamp } from "../../../domain/import/import";
import { ImportParseError } from "../../../domain/import/parser";
import { parseMt5Decimal } from "./parseDecimal";
import { parseMt5Timestamp } from "./parseTimestamp";
import { rowRecord, type CsvRow, type ScannedSection } from "./sectionScanner";

export interface SectionRecord {
  readonly row: CsvRow;
  readonly raw: Record<string, string>;
}

export function sectionRecords(section: ScannedSection): SectionRecord[] {
  if (!section.header) return [];
  return section.rows.map((row) => ({ row, raw: rowRecord(section.header!, row) }));
}

export function pick(record: Readonly<Record<string, string>>, ...names: string[]): string {
  const entry = Object.entries(record).find(([key]) =>
    names.some((name) => key.toLowerCase() === name.toLowerCase()));
  return entry?.[1]?.trim() ?? "";
}

export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseDecimalField(
  raw: string,
  section: ImportSection,
  rowNumber: number,
  field: string,
  issues: ImportIssue[],
): string | null {
  try {
    return parseMt5Decimal(raw);
  } catch {
    issues.push({
      code: "INVALID_DECIMAL", severity: "ERROR", section, rowNumber, field,
      message: `Invalid decimal in ${field}.`, safeRawValue: raw.slice(0, 80),
    });
    return null;
  }
}

export function parseTimeField(
  raw: string,
  timezone: string,
  section: ImportSection,
  rowNumber: number,
  field: string,
  issues: ImportIssue[],
): ParsedTimestamp | null {
  if (!raw.trim()) return null;
  try {
    return parseMt5Timestamp(raw, timezone);
  } catch (error) {
    if (error instanceof ImportParseError && error.code === "INVALID_TIMEZONE") throw error;
    issues.push({
      code: "INVALID_TIMESTAMP", severity: "ERROR", section, rowNumber, field,
      message: `Invalid timestamp in ${field}.`, safeRawValue: raw.slice(0, 80),
    });
    return null;
  }
}

export function rowHasError(issues: readonly ImportIssue[], section: ImportSection, rowNumber: number): boolean {
  return issues.some((issue) =>
    issue.section === section && issue.rowNumber === rowNumber &&
    (issue.severity === "ERROR" || issue.severity === "FATAL"));
}
