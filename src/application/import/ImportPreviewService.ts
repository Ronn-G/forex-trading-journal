import type { Account } from "../../domain/accounts/account";
import type { ImportReadRepository } from "../../domain/import/ImportRepository";
import type { ImportFileInput, Mt5ImportParser } from "../../domain/import/parser";
import { ImportParseError } from "../../domain/import/parser";
import type { ImportBatch, ImportIssue, ImportPreview, PreparedImport } from "../../domain/import/import";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export type ImportPreviewErrorCode =
  | "FILE_TOO_LARGE" | "FILE_SIZE_MISMATCH" | "PARSER_ERROR" | "REPOSITORY_ERROR";
export class ImportPreviewError extends Error {
  constructor(public readonly code: ImportPreviewErrorCode, message: string, public readonly cause?: unknown) {
    super(message); this.name = "ImportPreviewError";
  }
}
export class ImportPreviewService {
  constructor(private readonly parser: Mt5ImportParser, private readonly repository: ImportReadRepository) {}
  async preview(account: Account, file: ImportFileInput): Promise<ImportPreview> {
    if (file.size > MAX_IMPORT_BYTES) throw new ImportPreviewError("FILE_TOO_LARGE", "The file exceeds the 20 MB limit.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) throw new ImportPreviewError("FILE_SIZE_MISMATCH", "The selected file changed while reading.");
    let prepared: PreparedImport;
    try { prepared = await this.parser.parse(bytes, account.timezone); }
    catch (error) {
      const message = error instanceof ImportParseError ? error.message : "The report could not be parsed.";
      throw new ImportPreviewError("PARSER_ERROR", message, error);
    }
    let batch: ImportBatch | null;
    let positions: Set<string>;
    let orders: Set<string>;
    let deals: Set<string>;
    try {
      [batch, positions, orders, deals] = await Promise.all([
        this.repository.findBatchByAccountAndSha256(account.id, prepared.sourceSha256),
        this.repository.findExistingPositionIds(account.id, prepared.positions.map((row) => row.externalPositionId).filter(Boolean)),
        this.repository.findExistingOrderIds(account.id, prepared.orders.map((row) => row.externalOrderId).filter(Boolean)),
        this.repository.findExistingDealIds(account.id, prepared.deals.map((row) => row.externalDealId).filter(Boolean)),
      ]);
    } catch (error) {
      throw new ImportPreviewError("REPOSITORY_ERROR", "Import history could not be checked.", error);
    }
    const mismatches: ImportIssue[] = [];
    const warning = (code: string, message: string) =>
      mismatches.push({ code, severity: "WARNING", section: "METADATA", message });
    if (prepared.metadata.currency && prepared.metadata.currency !== account.accountCurrency) warning("CURRENCY_MISMATCH", "Report currency differs from the selected account.");
    if (prepared.metadata.server && prepared.metadata.server.toLowerCase() !== account.server.toLowerCase()) warning("SERVER_MISMATCH", "Report server differs from the selected account.");
    if (prepared.metadata.environment && (prepared.metadata.environment === "DEMO") !== account.isDemo) warning("ENVIRONMENT_MISMATCH", "Report environment differs from the selected account.");
    if (prepared.metadata.accountMode && prepared.metadata.accountMode !== account.accountType.toUpperCase()) warning("ACCOUNT_MODE_MISMATCH", "Report account mode differs from the selected account.");
    if (prepared.metadata.loginMasked && prepared.metadata.loginMasked !== account.loginMasked) warning("LOGIN_MISMATCH", "Masked report login differs from the selected account.");
    const allIssues = [...prepared.issues, ...mismatches];
    const duplicates = positions.size + orders.size + deals.size;
    const errorCount = allIssues.filter((issue) => issue.severity === "ERROR" || issue.severity === "FATAL").length;
    const warningCount = allIssues.filter((issue) => issue.severity === "WARNING").length;
    const valid = prepared.positions.filter((row) => row.valid).length + prepared.orders.filter((row) => row.valid).length +
      prepared.deals.filter((row) => row.valid).length;
    const preparedForCommit: PreparedImport = {
      ...prepared,
      positions: prepared.positions.filter((row) => row.valid && !positions.has(row.externalPositionId)),
      orders: prepared.orders.filter((row) => row.valid && !orders.has(row.externalOrderId)),
      deals: prepared.deals.filter((row) => row.valid && !deals.has(row.externalDealId)),
    };
    return {
      accountId: account.id,
      filename: file.name, fileSize: file.size, sourceSha256: prepared.sourceSha256,
      format: "VANTAGE_MT5_TRADE_HISTORY_CSV", parserVersion: this.parser.version, timezone: account.timezone,
      metadata: prepared.metadata, duplicateFile: Boolean(batch),
      counts: { totalRows: prepared.totalRows, positions: prepared.positions.length, orders: prepared.orders.length,
        deals: prepared.deals.length, results: prepared.results.length, valid, duplicate: duplicates,
        warning: warningCount, error: errorCount,
        estimatedTrades: prepared.positions.filter((row) => row.valid && !row.open && !positions.has(row.externalPositionId)).length },
      issues: allIssues.slice(0, 100),
      prepared: preparedForCommit,
    };
  }
}
