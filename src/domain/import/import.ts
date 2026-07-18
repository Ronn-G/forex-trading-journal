export type ImportSourceType = "VANTAGE_MT5_TRADE_HISTORY_CSV";
export const IMPORT_BATCH_STATUSES = ["PENDING", "PREVIEWED", "IMPORTED", "PARTIAL", "FAILED", "ROLLED_BACK"] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];
export type RawMt5RecordType = "METADATA" | "POSITION" | "ORDER" | "DEAL" | "RESULT";
export type ImportIssueSeverity = "INFO" | "WARNING" | "ERROR" | "FATAL";
export type ImportSection = "FILE" | "METADATA" | "POSITIONS" | "ORDERS" | "DEALS" | "RESULTS";

export interface ImportBatch {
  readonly id: string; readonly accountId: string; readonly sourceType: ImportSourceType;
  readonly sourceFilename: string; readonly sourceSha256: string; readonly parserVersion: string;
  readonly status: ImportBatchStatus; readonly totalRows: number; readonly importedRows: number;
  readonly skippedRows: number; readonly warningRows: number; readonly errorRows: number;
  readonly startedAt: number; readonly completedAt: number | null;
  readonly failureCode: string | null; readonly failureMessage: string | null;
}
export interface RawMt5Record {
  readonly id: string; readonly importBatchId: string; readonly accountId: string;
  readonly recordType: RawMt5RecordType; readonly externalId: string | null;
  readonly rowNumber: number; readonly rawJson: string; readonly createdAt: number;
}
export interface ImportIssue {
  readonly code: string; readonly severity: ImportIssueSeverity; readonly section: ImportSection;
  readonly rowNumber?: number; readonly field?: string; readonly message: string; readonly safeRawValue?: string;
}
export interface ReportAccountMetadata {
  readonly loginMasked: string | null; readonly currency: string | null; readonly server: string | null;
  readonly environment: "DEMO" | "REAL" | null; readonly accountMode: "HEDGE" | "NETTING" | null;
  readonly generatedAtOriginal: string | null;
}
export interface ParsedTimestamp { readonly original: string; readonly epochMs: number }
interface ParsedRecord { readonly rowNumber: number; readonly raw: Readonly<Record<string, string>> }
export interface ParsedPosition extends ParsedRecord {
  readonly externalPositionId: string; readonly symbol: string; readonly side: "BUY" | "SELL" | null;
  readonly volume: string | null; readonly openPrice: string | null; readonly stopLoss: string | null;
  readonly takeProfit: string | null; readonly openedAt: ParsedTimestamp | null;
  readonly closePrice: string | null; readonly closedAt: ParsedTimestamp | null;
  readonly commission: string | null; readonly swap: string | null; readonly profit: string | null;
  readonly valid: boolean; readonly open: boolean;
}
export interface ParsedOrder extends ParsedRecord {
  readonly externalOrderId: string; readonly externalPositionId: string | null;
  readonly symbol: string; readonly orderType: string;
  readonly volumeInitial: string | null; readonly volumeCurrent: string | null;
  readonly openPrice: string | null; readonly stopLoss: string | null; readonly takeProfit: string | null;
  readonly placedAt: ParsedTimestamp | null; readonly closedAt: ParsedTimestamp | null;
  readonly comment: string | null; readonly magicNumber: string | null; readonly valid: boolean;
}
export interface ParsedDeal extends ParsedRecord {
  readonly externalDealId: string; readonly externalOrderId: string | null;
  readonly externalPositionId: string | null; readonly symbol: string;
  readonly side: "BUY" | "SELL" | null; readonly entryType: string;
  readonly volume: string | null; readonly price: string | null;
  readonly commission: string | null; readonly swap: string | null; readonly profit: string | null;
  readonly executedAt: ParsedTimestamp | null; readonly comment: string | null;
  readonly magicNumber: string | null; readonly valid: boolean;
}
export interface ParsedResult extends ParsedRecord { readonly label: string; readonly value: string }
export interface PreparedImport {
  readonly sourceSha256: string; readonly metadata: ReportAccountMetadata;
  readonly positions: readonly ParsedPosition[]; readonly orders: readonly ParsedOrder[];
  readonly deals: readonly ParsedDeal[]; readonly results: readonly ParsedResult[];
  readonly issues: readonly ImportIssue[]; readonly totalRows: number;
}
export interface ImportPreview {
  readonly accountId: string; readonly filename: string; readonly fileSize: number; readonly sourceSha256: string;
  readonly format: ImportSourceType; readonly parserVersion: string; readonly timezone: string;
  readonly metadata: ReportAccountMetadata;
  readonly counts: {
    readonly totalRows: number; readonly positions: number; readonly orders: number; readonly deals: number;
    readonly results: number; readonly valid: number; readonly duplicate: number; readonly warning: number;
    readonly error: number; readonly estimatedTrades: number;
  };
  readonly duplicateFile: boolean; readonly issues: readonly ImportIssue[];
  readonly prepared: PreparedImport;
}
export function maskAccountLogin(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits ? `***${digits.slice(-4)}` : null;
}
