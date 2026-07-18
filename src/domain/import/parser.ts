import type { PreparedImport } from "./import";
export const VANTAGE_MT5_CSV_PARSER_VERSION = "vantage-mt5-trade-history-csv@1";
export interface ImportFileInput {
  readonly name: string; readonly size: number; arrayBuffer(): Promise<ArrayBuffer>;
}
export interface Mt5ImportParser {
  readonly version: string;
  parse(bytes: Uint8Array, timezone: string): Promise<PreparedImport>;
}
export class ImportParseError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message); this.name = "ImportParseError";
  }
}
