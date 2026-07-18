import type { ParsedResult } from "../../../domain/import/import";
import { sectionRecords } from "./sectionHelpers";
import type { ScannedSection } from "./sectionScanner";

export function parseResults(section: ScannedSection): ParsedResult[] {
  return sectionRecords(section).map(({ row, raw }) => {
    const values = Object.values(raw);
    return { rowNumber: row.rowNumber, raw, label: values[0] ?? "", value: values[1] ?? "" };
  });
}
