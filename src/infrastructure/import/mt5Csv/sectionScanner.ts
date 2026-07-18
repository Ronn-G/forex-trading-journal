import type { ImportIssue } from "../../../domain/import/import";

export interface CsvRow { readonly rowNumber: number; readonly cells: readonly string[] }
export interface ScannedSection { readonly header: CsvRow | null; readonly rows: readonly CsvRow[] }
export interface ScannedReport {
  readonly metadata: readonly CsvRow[];
  readonly positions: ScannedSection; readonly orders: ScannedSection;
  readonly deals: ScannedSection; readonly results: ScannedSection;
  readonly issues: readonly ImportIssue[]; readonly totalRows: number;
}

export function parseCsvRows(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = []; let field = ""; let quoted = false; let rowNumber = 1;
  const finishField = () => { cells.push(field); field = ""; };
  const finishRow = () => {
    finishField();
    rows.push({ rowNumber, cells }); cells = []; rowNumber += 1;
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) finishField();
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      finishRow();
    } else field += char;
  }
  if (quoted) throw new Error("UNCLOSED_QUOTE");
  if (field || cells.length) finishRow();
  return rows;
}

type DataSection = "POSITIONS" | "ORDERS" | "DEALS" | "RESULTS";
const sectionNames = new Map<string, DataSection>([
  ["positions", "POSITIONS"], ["orders", "ORDERS"], ["deals", "DEALS"], ["results", "RESULTS"],
]);
export function scanSections(text: string): ScannedReport {
  const allRows = parseCsvRows(text);
  const metadata: CsvRow[] = []; const issues: ImportIssue[] = [];
  const sections: Record<"POSITIONS" | "ORDERS" | "DEALS" | "RESULTS", { header: CsvRow | null; rows: CsvRow[] }> = {
    POSITIONS: { header: null, rows: [] }, ORDERS: { header: null, rows: [] },
    DEALS: { header: null, rows: [] }, RESULTS: { header: null, rows: [] },
  };
  let current: keyof typeof sections | null = null;
  let skippingUnknownSection = false;
  for (const row of allRows) {
    if (row.cells.every((cell) => !cell.trim())) continue;
    const label = row.cells[0]?.trim().toLowerCase();
    const recognized = sectionNames.get(label);
    if (recognized) { current = recognized; skippingUnknownSection = false; continue; }
    const isUnknownSectionLabel =
      current !== null &&
      sections[current].header !== null &&
      row.cells.length === 1 &&
      /^[A-Za-z][A-Za-z0-9 /_-]{1,60}$/.test(row.cells[0].trim());
    if (isUnknownSectionLabel) {
      issues.push({
        code: "UNKNOWN_SECTION", severity: "WARNING", section: current ?? "FILE",
        rowNumber: row.rowNumber, message: `Unsupported section "${row.cells[0].trim()}" was skipped.`,
      });
      skippingUnknownSection = true;
      continue;
    }
    if (skippingUnknownSection) continue;
    if (!current) { metadata.push(row); continue; }
    if (!sections[current].header) { sections[current].header = row; continue; }
    const header = sections[current].header!;
    if (row.cells.join("\u0000").toLowerCase() === header.cells.join("\u0000").toLowerCase()) {
      issues.push({ code: "REPEATED_HEADER", severity: "WARNING", section: current, rowNumber: row.rowNumber,
        message: "A repeated section header was skipped." });
      continue;
    }
    if (row.cells.length !== header.cells.length) {
      issues.push({ code: "ROW_WIDTH_MISMATCH", severity: "ERROR", section: current, rowNumber: row.rowNumber,
        message: "The row has a different number of columns than its section header." });
      continue;
    }
    sections[current].rows.push(row);
  }
  if (!sections.POSITIONS.header) {
    issues.push({ code: "TRUNCATED_REPORT", severity: "FATAL", section: "POSITIONS",
      message: "The Positions header is missing." });
  }
  return { metadata, positions: sections.POSITIONS, orders: sections.ORDERS, deals: sections.DEALS,
    results: sections.RESULTS, issues, totalRows: allRows.length };
}

export function rowRecord(header: CsvRow, row: CsvRow): Record<string, string> {
  const record: Record<string, string> = {};
  header.cells.forEach((cell, index) => {
    const base = cell.trim();
    let key = base;
    let duplicate = 1;
    while (key in record) { key = `${base}.${duplicate}`; duplicate += 1; }
    record[key] = row.cells[index]?.trim() ?? "";
  });
  return record;
}
