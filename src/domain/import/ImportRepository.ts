import type { ImportBatch } from "./import";
export interface ImportReadRepository {
  findBatchByAccountAndSha256(accountId: string, sha256: string): Promise<ImportBatch | null>;
  findExistingPositionIds(accountId: string, ids: readonly string[]): Promise<Set<string>>;
  findExistingOrderIds(accountId: string, ids: readonly string[]): Promise<Set<string>>;
  findExistingDealIds(accountId: string, ids: readonly string[]): Promise<Set<string>>;
  listRecentImportBatches(accountId: string, limit?: number): Promise<ImportBatch[]>;
}
