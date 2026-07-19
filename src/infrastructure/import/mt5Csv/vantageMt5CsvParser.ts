import type { PreparedImport } from "../../../domain/import/import";
import { ImportParseError, VANTAGE_MT5_CSV_PARSER_VERSION, type Mt5ImportParser } from "../../../domain/import/parser";
import { assertVantageMt5Csv } from "../detectFormat";
import { decodeUtf8 } from "../encoding";
import { sha256Hex } from "../hash";
import { parseDeals } from "./parseDeals";
import { parseMetadata } from "./parseMetadata";
import { parseOrders } from "./parseOrders";
import { parsePositions } from "./parsePositions";
import { parseResults } from "./parseResults";
import { scanSections } from "./sectionScanner";

function invalidateDuplicateIds<T extends { readonly rowNumber: number; readonly valid: boolean }>(
  rows: readonly T[],
  idOf: (row: T) => string,
  code: string,
  section: "POSITIONS" | "ORDERS" | "DEALS",
  issues: import("../../../domain/import/import").ImportIssue[],
): T[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const id = idOf(row);
    if (!id || !seen.has(id)) {
      if (id) seen.add(id);
      return row;
    }
    issues.push({
      code, severity: "ERROR", section, rowNumber: row.rowNumber,
      message: `Duplicate external ID "${id}" in the same report.`,
    });
    return { ...row, valid: false };
  });
}

export class VantageMt5CsvParser implements Mt5ImportParser {
  readonly version = VANTAGE_MT5_CSV_PARSER_VERSION;
  async parse(bytes: Uint8Array, timezone: string): Promise<PreparedImport> {
    const text = decodeUtf8(bytes); assertVantageMt5Csv(text);
    const sourceSha256 = await sha256Hex(bytes);
    let scanned;
    try { scanned = scanSections(text); }
    catch { throw new ImportParseError("MALFORMED_CSV", "The CSV contains an unclosed quoted field."); }
    if (scanned.totalRows > 100_000) throw new ImportParseError("TOO_MANY_RECORDS", "The report exceeds 100,000 rows.");
    const issues = [...scanned.issues];
    const positions = invalidateDuplicateIds(
      parsePositions(scanned.positions, timezone, issues),
      (row) => row.externalPositionId, "DUPLICATE_POSITION_ID", "POSITIONS", issues,
    );
    const orders = invalidateDuplicateIds(
      parseOrders(scanned.orders, timezone, issues),
      (row) => row.externalOrderId, "DUPLICATE_ORDER_ID", "ORDERS", issues,
    );
    const deals = invalidateDuplicateIds(
      parseDeals(scanned.deals, timezone, issues),
      (row) => row.externalDealId, "DUPLICATE_DEAL_ID", "DEALS", issues,
    );
    const results = parseResults(scanned.results);
    return { sourceSha256, metadata: parseMetadata(scanned.metadata), positions, orders, deals, results,
      issues, totalRows: scanned.totalRows };
  }
}
