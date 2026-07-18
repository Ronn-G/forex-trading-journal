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
    const positions = parsePositions(scanned.positions, timezone, issues);
    const orders = parseOrders(scanned.orders, timezone, issues);
    const deals = parseDeals(scanned.deals, timezone, issues);
    const results = parseResults(scanned.results);
    return { sourceSha256, metadata: parseMetadata(scanned.metadata), positions, orders, deals, results,
      issues, totalRows: scanned.totalRows };
  }
}
