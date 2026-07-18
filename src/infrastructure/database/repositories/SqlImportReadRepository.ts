import type Database from "@tauri-apps/plugin-sql";
import type { ImportReadRepository } from "../../../domain/import/ImportRepository";
import type { ImportBatch, RawMt5RecordType } from "../../../domain/import/import";
import { DatabaseError } from "../../../shared/errors";
import { getDatabaseConnection } from "../client";

type ImportDatabase = Pick<Database, "select">;
type DatabaseProvider = () => Promise<ImportDatabase>;
interface BatchRow {
  id: string; account_id: string; source_type: "VANTAGE_MT5_TRADE_HISTORY_CSV"; source_filename: string;
  source_sha256: string; parser_version: string; status: ImportBatch["status"]; total_rows: number;
  imported_rows: number; skipped_rows: number; warning_rows: number; error_rows: number; started_at: number;
  completed_at: number | null; failure_code: string | null; failure_message: string | null;
}
const toBatch = (row: BatchRow): ImportBatch => ({
  id: row.id, accountId: row.account_id, sourceType: row.source_type, sourceFilename: row.source_filename,
  sourceSha256: row.source_sha256, parserVersion: row.parser_version, status: row.status,
  totalRows: row.total_rows, importedRows: row.imported_rows, skippedRows: row.skipped_rows,
  warningRows: row.warning_rows, errorRows: row.error_rows, startedAt: row.started_at,
  completedAt: row.completed_at, failureCode: row.failure_code, failureMessage: row.failure_message,
});
const batchColumns = `id, account_id, source_type, source_filename, source_sha256, parser_version, status,
  total_rows, imported_rows, skipped_rows, warning_rows, error_rows, started_at, completed_at,
  failure_code, failure_message`;

export class SqlImportReadRepository implements ImportReadRepository {
  constructor(private readonly getDb: DatabaseProvider = getDatabaseConnection) {}
  async findBatchByAccountAndSha256(accountId: string, sha256: string): Promise<ImportBatch | null> {
    return this.guard(async () => {
      const rows = await (await this.getDb()).select<BatchRow[]>(
        `SELECT ${batchColumns} FROM import_batches WHERE account_id = $1 AND source_sha256 = $2 LIMIT 1`,
        [accountId, sha256],
      );
      return rows[0] ? toBatch(rows[0]) : null;
    });
  }
  findExistingPositionIds(accountId: string, ids: readonly string[]) {
    return this.findIds(accountId, "POSITION", ids);
  }
  findExistingOrderIds(accountId: string, ids: readonly string[]) {
    return this.findIds(accountId, "ORDER", ids);
  }
  findExistingDealIds(accountId: string, ids: readonly string[]) {
    return this.findIds(accountId, "DEAL", ids);
  }
  async listRecentImportBatches(accountId: string, limit = 20): Promise<ImportBatch[]> {
    return this.guard(async () => {
      const rows = await (await this.getDb()).select<BatchRow[]>(
        `SELECT ${batchColumns} FROM import_batches WHERE account_id = $1 ORDER BY started_at DESC LIMIT $2`,
        [accountId, Math.max(1, Math.min(limit, 100))],
      );
      return rows.map(toBatch);
    });
  }
  private async findIds(accountId: string, type: RawMt5RecordType, ids: readonly string[]): Promise<Set<string>> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueIds.length) return new Set();
    return this.guard(async () => {
      const db = await this.getDb();
      const found = new Set<string>();
      for (let offset = 0; offset < uniqueIds.length; offset += 500) {
        const chunk = uniqueIds.slice(offset, offset + 500);
        const placeholders = chunk.map((_, index) => `$${index + 3}`).join(", ");
        const rows = await db.select<Array<{ external_id: string }>>(
          `SELECT external_id FROM raw_mt5_records
            WHERE account_id = $1 AND record_type = $2 AND external_id IN (${placeholders})`,
          [accountId, type, ...chunk],
        );
        rows.forEach((row) => found.add(row.external_id));
      }
      return found;
    });
  }
  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) { throw new DatabaseError("Failed to read import history", error); }
  }
}
