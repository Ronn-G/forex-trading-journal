import { invoke } from "@tauri-apps/api/core";
import type { ImportPreview, PreparedImport } from "../../domain/import/import";

export interface CommitImportResult {
  readonly batchId: string;
  readonly rawRecordsInserted: number;
  readonly positionsInserted: number;
  readonly ordersInserted: number;
  readonly dealsInserted: number;
  readonly tradesInserted: number;
  readonly skippedDuplicates: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly completedAt: number;
}

export type ImportCommitErrorCode =
  | "STALE_PREVIEW" | "DUPLICATE_IMPORT" | "VALIDATION_ERROR" | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_ARCHIVED" | "ENTITY_CONFLICT" | "DATABASE_UNAVAILABLE"
  | "TRANSACTION_FAILED" | "INTERNAL_ERROR";

export class ImportCommitError extends Error {
  constructor(
    public readonly code: ImportCommitErrorCode,
    message: string,
    public readonly existingBatchId?: string,
    public readonly cause?: unknown,
  ) {
    super(message); this.name = "ImportCommitError";
  }
}

interface RustError {
  readonly code?: string;
  readonly message?: string;
  readonly existingBatchId?: string;
}

const rawKey = (type: string, rowNumber: number) => `${type}:${rowNumber}`;
const id = () => crypto.randomUUID();

function buildPayload(preview: ImportPreview, accountId: string) {
  const prepared: PreparedImport = preview.prepared;
  const rawRecords = [
    ...prepared.positions.map((row) => ({ type: "POSITION", externalId: row.externalPositionId, row })),
    ...prepared.orders.map((row) => ({ type: "ORDER", externalId: row.externalOrderId, row })),
    ...prepared.deals.map((row) => ({ type: "DEAL", externalId: row.externalDealId, row })),
    ...prepared.results.map((row) => ({ type: "RESULT", externalId: null, row })),
  ].map(({ type, externalId, row }) => ({
    id: id(), key: rawKey(type, row.rowNumber), recordType: type, externalId,
    rowNumber: row.rowNumber, rawJson: JSON.stringify({
      section: type, rowNumber: row.rowNumber, values: row.raw,
    }),
  }));
  return {
    batchId: id(), accountId,
    source: { filename: preview.filename, sourceType: preview.format, sha256: preview.sourceSha256,
      parserVersion: preview.parserVersion, sizeBytes: preview.fileSize },
    counts: { totalRows: preview.counts.totalRows, skippedRows: preview.counts.duplicate,
      warningRows: preview.counts.warning, errorRows: preview.counts.error },
    rawRecords,
    positions: prepared.positions.map((row) => ({
      id: id(), rawKey: rawKey("POSITION", row.rowNumber), externalPositionId: row.externalPositionId,
      symbol: row.symbol, side: row.side!, volume: row.volume!, openPrice: row.openPrice!,
      stopLoss: row.stopLoss, takeProfit: row.takeProfit, openedAt: row.openedAt!.epochMs,
      originalOpenedAt: row.openedAt!.original, closePrice: row.closePrice,
      closedAt: row.closedAt?.epochMs ?? null, originalClosedAt: row.closedAt?.original ?? null,
      commission: row.commission!, swap: row.swap!, profit: row.profit!, status: row.open ? "OPEN" : "CLOSED",
    })),
    orders: prepared.orders.map((row) => ({
      id: id(), rawKey: rawKey("ORDER", row.rowNumber), externalOrderId: row.externalOrderId,
      externalPositionId: row.externalPositionId, symbol: row.symbol, orderType: row.orderType,
      volumeInitial: row.volumeInitial!, volumeCurrent: row.volumeCurrent, openPrice: row.openPrice,
      stopLoss: row.stopLoss, takeProfit: row.takeProfit, placedAt: row.placedAt!.epochMs,
      originalPlacedAt: row.placedAt!.original, closedAt: row.closedAt?.epochMs ?? null,
      originalClosedAt: row.closedAt?.original ?? null, comment: row.comment, magicNumber: row.magicNumber,
    })),
    deals: prepared.deals.map((row) => ({
      id: id(), rawKey: rawKey("DEAL", row.rowNumber), externalDealId: row.externalDealId,
      externalOrderId: row.externalOrderId, externalPositionId: row.externalPositionId,
      symbol: row.symbol, side: row.side!, entryType: row.entryType, volume: row.volume!, price: row.price!,
      commission: row.commission, swap: row.swap, profit: row.profit,
      executedAt: row.executedAt!.epochMs, originalExecutedAt: row.executedAt!.original,
      comment: row.comment, magicNumber: row.magicNumber,
    })),
    startedAt: Date.now(),
  };
}

export class ImportService {
  private activeCommit: Promise<CommitImportResult> | null = null;
  constructor(private readonly invokeCommand: typeof invoke = invoke) {}

  commit(preview: ImportPreview, accountId: string, sourceSha256: string): Promise<CommitImportResult> {
    if (preview.accountId !== accountId
      || preview.sourceSha256 !== sourceSha256
      || preview.prepared.sourceSha256 !== sourceSha256) {
      return Promise.reject(new ImportCommitError("STALE_PREVIEW", "Bản xem trước không còn khớp với file đã chọn."));
    }
    if (preview.duplicateFile) {
      return Promise.reject(new ImportCommitError("DUPLICATE_IMPORT", "File này đã được nhập trước đó."));
    }
    if (this.activeCommit) return this.activeCommit;
    this.activeCommit = this.invokeCommand<CommitImportResult>("commit_mt5_import", {
      payload: buildPayload(preview, accountId),
    }).catch((error: RustError) => {
      const known = new Set<ImportCommitErrorCode>([
        "DUPLICATE_IMPORT", "VALIDATION_ERROR", "ACCOUNT_NOT_FOUND", "ACCOUNT_ARCHIVED",
        "ENTITY_CONFLICT", "DATABASE_UNAVAILABLE", "TRANSACTION_FAILED", "INTERNAL_ERROR",
      ]);
      const code = known.has(error?.code as ImportCommitErrorCode)
        ? error.code as ImportCommitErrorCode : "INTERNAL_ERROR";
      const message = code === "INTERNAL_ERROR"
        ? "Không thể hoàn tất nhập dữ liệu."
        : error?.message ?? "Không thể hoàn tất nhập dữ liệu.";
      throw new ImportCommitError(code, message,
        error?.existingBatchId, error);
    }).finally(() => { this.activeCommit = null; });
    return this.activeCommit;
  }
}
