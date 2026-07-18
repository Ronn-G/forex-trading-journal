import { describe, expect, it, vi } from "vitest";
import type { ImportPreview } from "../../domain/import/import";
import { ImportService } from "./ImportService";

function preview(overrides: Partial<ImportPreview> = {}): ImportPreview {
  const prepared = {
    sourceSha256: "a".repeat(64),
    metadata: { loginMasked: "***1234", currency: "USD", server: "Synthetic",
      environment: "REAL" as const, accountMode: "HEDGE" as const, generatedAtOriginal: null },
    positions: [{ rowNumber: 5, raw: { Symbol: "EURUSD" }, externalPositionId: "p1", symbol: "EURUSD",
      side: "BUY" as const, volume: "0.1", openPrice: "1.1", stopLoss: null, takeProfit: null,
      openedAt: { original: "2026.01.01 00:00:00", epochMs: 1 }, closePrice: "1.2",
      closedAt: { original: "2026.01.01 01:00:00", epochMs: 2 }, commission: "0", swap: "0",
      profit: "1", valid: true, open: false }],
    orders: [], deals: [], results: [], issues: [], totalRows: 5,
  };
  return {
    accountId: "account-a", filename: "synthetic.csv", fileSize: 100, sourceSha256: prepared.sourceSha256,
    format: "VANTAGE_MT5_TRADE_HISTORY_CSV", parserVersion: "vantage-mt5-trade-history-csv@1",
    timezone: "UTC", metadata: prepared.metadata,
    counts: { totalRows: 5, positions: 1, orders: 0, deals: 0, results: 0,
      valid: 1, duplicate: 0, warning: 0, error: 0, estimatedTrades: 1 },
    duplicateFile: false, issues: [], prepared, ...overrides,
  };
}

describe("ImportService", () => {
  it("invokes the Rust command with a canonical account-scoped payload", async () => {
    const result = { batchId: "b", rawRecordsInserted: 1, positionsInserted: 1, ordersInserted: 0,
      dealsInserted: 0, skippedDuplicates: 0, warningCount: 0, errorCount: 0, completedAt: 2 };
    const invoke = vi.fn().mockResolvedValue(result);
    await expect(new ImportService(invoke).commit(preview(), "account-a", "a".repeat(64))).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith("commit_mt5_import", {
      payload: expect.objectContaining({
        accountId: "account-a",
        source: expect.objectContaining({ sha256: "a".repeat(64) }),
        rawRecords: [expect.objectContaining({ recordType: "POSITION", externalId: "p1" })],
      }),
    });
    expect(JSON.stringify(invoke.mock.calls[0])).not.toMatch(/password|databasePath|fullLogin/i);
  });

  it("rejects changed fingerprints and duplicate previews without invoke", async () => {
    const invoke = vi.fn();
    const service = new ImportService(invoke);
    await expect(service.commit(preview(), "account-a", "b".repeat(64))).rejects.toMatchObject({ code: "STALE_PREVIEW" });
    await expect(service.commit(preview(), "changed-account", "a".repeat(64))).rejects.toMatchObject({ code: "STALE_PREVIEW" });
    await expect(service.commit(preview({ duplicateFile: true }), "account-a", "a".repeat(64)))
      .rejects.toMatchObject({ code: "DUPLICATE_IMPORT" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("maps typed and unexpected command failures safely", async () => {
    await expect(new ImportService(vi.fn().mockRejectedValue({
      code: "ACCOUNT_ARCHIVED", message: "Archived", existingBatchId: undefined,
    })).commit(preview(), "account-a", "a".repeat(64))).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
    await expect(new ImportService(vi.fn().mockRejectedValue(new Error("raw SQL path")))
      .commit(preview(), "account-a", "a".repeat(64))).rejects.toMatchObject({
        code: "INTERNAL_ERROR", message: "Không thể hoàn tất nhập dữ liệu.",
      });
  });

  it("coalesces concurrent submissions into one invoke", async () => {
    let resolve!: (value: unknown) => void;
    const invoke = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; }));
    const service = new ImportService(invoke);
    const first = service.commit(preview(), "account-a", "a".repeat(64));
    const second = service.commit(preview(), "account-a", "a".repeat(64));
    expect(first).toBe(second); expect(invoke).toHaveBeenCalledTimes(1);
    resolve({ batchId: "b" });
    await first;
  });
});
