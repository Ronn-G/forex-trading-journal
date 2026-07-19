import { describe, expect, it, vi } from "vitest";
import type { Account } from "../../domain/accounts/account";
import type { ImportReadRepository } from "../../domain/import/ImportRepository";
import type { ImportBatch, ImportIssue, ParsedPosition, PreparedImport } from "../../domain/import/import";
import { ImportParseError, type ImportFileInput, type Mt5ImportParser } from "../../domain/import/parser";
import { ImportPreviewError, ImportPreviewService, MAX_IMPORT_BYTES } from "./ImportPreviewService";

const account: Account = {
  id: "account-a", name: "Synthetic", broker: "Vantage", server: "VantageMarkets-Live 13",
  loginMasked: "***5678", accountCurrency: "USD", accountType: "Hedge",
  timezone: "Asia/Ho_Chi_Minh", isDemo: false, isArchived: false, createdAt: 1, updatedAt: 1,
};
const position = (id: string, open = false, valid = true): ParsedPosition => ({
  rowNumber: 10, raw: {}, externalPositionId: id, symbol: "EURUSD", side: "BUY",
  volume: "0.10", openPrice: "1.1", stopLoss: null, takeProfit: null,
  openedAt: { original: "2026.01.01 10:00:00", epochMs: 1 },
  closePrice: open ? null : "1.2", closedAt: open ? null : { original: "2026.01.01 11:00:00", epochMs: 2 },
  commission: "0", swap: "0", profit: "1", valid, open,
});
const basePrepared = (issues: ImportIssue[] = []): PreparedImport => ({
  sourceSha256: "abc", metadata: {
    loginMasked: "***5678", currency: "USD", server: "VantageMarkets-Live 13",
    environment: "REAL", accountMode: "HEDGE", generatedAtOriginal: null,
  },
  positions: [position("p1"), position("open", true), position("bad", false, false)],
  orders: [{ rowNumber: 20, raw: {}, externalOrderId: "o1", externalPositionId: "p1", symbol: "EURUSD",
    orderType: "buy", volumeInitial: "0.1", volumeCurrent: "0", openPrice: "1.1", stopLoss: null,
    takeProfit: null, placedAt: null, closedAt: null, comment: null, magicNumber: null, valid: true }],
  deals: [{ rowNumber: 30, raw: {}, externalDealId: "d1", externalOrderId: "o1", externalPositionId: "p1",
    symbol: "EURUSD", side: "BUY", entryType: "in", volume: "0.1", price: "1.1", commission: "0",
    swap: "0", profit: "0", executedAt: null, comment: null, magicNumber: null, valid: true }],
  results: [{ rowNumber: 40, raw: {}, label: "Balance", value: "100" }], issues, totalRows: 40,
});
const parser = (prepared = basePrepared()): Mt5ImportParser => ({
  version: "vantage-mt5-trade-history-csv@1", parse: vi.fn().mockResolvedValue(prepared),
});
const batch: ImportBatch = {
  id: "b", accountId: "account-a", sourceType: "VANTAGE_MT5_TRADE_HISTORY_CSV",
  sourceFilename: "x.csv", sourceSha256: "abc", parserVersion: "v1", status: "IMPORTED",
  totalRows: 1, importedRows: 1, skippedRows: 0, warningRows: 0, errorRows: 0,
  startedAt: 1, completedAt: 2, failureCode: null, failureMessage: null,
};
function repository(overrides: Partial<ImportReadRepository> = {}): ImportReadRepository {
  return {
    findBatchByAccountAndSha256: vi.fn().mockResolvedValue(null),
    findExistingPositionIds: vi.fn().mockResolvedValue(new Set()),
    findExistingOrderIds: vi.fn().mockResolvedValue(new Set()),
    findExistingDealIds: vi.fn().mockResolvedValue(new Set()),
    listRecentImportBatches: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}
function file(size = 3): ImportFileInput {
  return { name: "synthetic.csv", size, arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array(size).buffer) };
}

describe("ImportPreviewService", () => {
  it("builds a valid read-only preview and estimates only closed valid positions", async () => {
    const repo = repository();
    const preview = await new ImportPreviewService(parser(), repo).preview(account, file());
    expect(preview.accountId).toBe(account.id);
    expect(preview.counts).toMatchObject({
      positions: 3, orders: 1, deals: 1, results: 1, valid: 4, duplicate: 0, estimatedTrades: 1,
    });
    expect(Object.keys(repo)).not.toContain(expect.stringMatching(/create|insert|update|delete|write/i));
  });
  it("marks a duplicate file only in the selected account", async () => {
    const sameAccount = repository({ findBatchByAccountAndSha256: vi.fn().mockResolvedValue(batch) });
    expect((await new ImportPreviewService(parser(), sameAccount).preview(account, file())).duplicateFile).toBe(true);
    const scoped = repository({ findBatchByAccountAndSha256: vi.fn(async (id) => id === "other" ? batch : null) });
    expect((await new ImportPreviewService(parser(), scoped).preview(account, file())).duplicateFile).toBe(false);
  });
  it("counts position, order, and deal duplicates without cross-account leakage", async () => {
    const repo = repository({
      findExistingPositionIds: vi.fn(async (id: string) => id === account.id ? new Set(["p1"]) : new Set<string>()),
      findExistingOrderIds: vi.fn(async (id: string) => id === account.id ? new Set(["o1"]) : new Set<string>()),
      findExistingDealIds: vi.fn(async (id: string) => id === account.id ? new Set(["d1"]) : new Set<string>()),
    });
    const preview = await new ImportPreviewService(parser(), repo).preview(account, file());
    expect(preview.counts.duplicate).toBe(3); expect(preview.counts.estimatedTrades).toBe(0);
    expect(vi.mocked(repo.findExistingDealIds).mock.calls[0][0]).toBe("account-a");
  });
  it("maps parser and repository failures to typed application errors", async () => {
    const failedParser: Mt5ImportParser = {
      version: "v1", parse: vi.fn().mockRejectedValue(new ImportParseError("UNSUPPORTED_FORMAT", "Unsupported")),
    };
    await expect(new ImportPreviewService(failedParser, repository()).preview(account, file()))
      .rejects.toMatchObject({ code: "PARSER_ERROR", cause: expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }) });
    const failedRepo = repository({ findExistingDealIds: vi.fn().mockRejectedValue(new Error("db")) });
    await expect(new ImportPreviewService(parser(), failedRepo).preview(account, file()))
      .rejects.toMatchObject({ code: "REPOSITORY_ERROR" });
  });
  it("maps unexpected parser failures without exposing their raw message", async () => {
    const unexpected = new Error("raw parser internals and sensitive context");
    const failedParser: Mt5ImportParser = {
      version: "v1", parse: vi.fn().mockRejectedValue(unexpected),
    };
    await expect(new ImportPreviewService(failedParser, repository()).preview(account, file()))
      .rejects.toMatchObject({
        code: "PARSER_ERROR", message: "The report could not be parsed.", cause: unexpected,
      });
  });
  it("caps issue samples at 100 while retaining full counts", async () => {
    const issues = Array.from({ length: 125 }, (_, index): ImportIssue => ({
      code: `W${index}`, severity: "WARNING", section: "POSITIONS", rowNumber: index + 1, message: "Safe warning",
    }));
    const preview = await new ImportPreviewService(parser(basePrepared(issues)), repository()).preview(account, file());
    expect(preview.issues).toHaveLength(100); expect(preview.counts.warning).toBe(125);
  });
  it.each([
    ["POSITIONS", "DUPLICATE_POSITION_ID", "positions"],
    ["ORDERS", "DUPLICATE_ORDER_ID", "orders"],
    ["DEALS", "DUPLICATE_DEAL_ID", "deals"],
  ] as const)("excludes invalid later duplicate %s rows from canonical commit data", async (
    section, code, collection,
  ) => {
    const prepared = basePrepared();
    const first = prepared[collection][0];
    const duplicate = { ...first, rowNumber: first.rowNumber + 1, valid: false };
    const withDuplicate: PreparedImport = {
      ...prepared,
      [collection]: [...prepared[collection], duplicate],
      issues: [{
        code, severity: "ERROR", section, rowNumber: duplicate.rowNumber,
        message: "Synthetic duplicate external ID.",
      }],
      totalRows: prepared.totalRows + 1,
    };
    const preview = await new ImportPreviewService(parser(withDuplicate), repository())
      .preview(account, file());
    expect(preview.prepared[collection]).toHaveLength(
      prepared[collection].filter((row) => row.valid).length,
    );
    expect(preview.prepared[collection]).not.toContainEqual(duplicate);
    expect(preview.counts.error).toBe(1);
    expect(preview.issues).toContainEqual(expect.objectContaining({
      code, section, rowNumber: duplicate.rowNumber,
    }));
    if (collection === "positions") expect(preview.counts.estimatedTrades).toBe(1);
  });
  it("adds every metadata mismatch warning", async () => {
    const prepared = basePrepared();
    const mismatch: PreparedImport = { ...prepared, metadata: {
      loginMasked: "***9999", currency: "EUR", server: "Other", environment: "DEMO",
      accountMode: "NETTING", generatedAtOriginal: null,
    } };
    const preview = await new ImportPreviewService(parser(mismatch), repository()).preview(account, file());
    expect(preview.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "CURRENCY_MISMATCH", "SERVER_MISMATCH", "ENVIRONMENT_MISMATCH", "ACCOUNT_MODE_MISMATCH", "LOGIN_MISMATCH",
    ]));
  });
  it("rejects oversized or changing files before repository reads", async () => {
    const repo = repository();
    await expect(new ImportPreviewService(parser(), repo).preview(account, file(MAX_IMPORT_BYTES + 1)))
      .rejects.toBeInstanceOf(ImportPreviewError);
    const changing = { name: "x.csv", size: 4, arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array(3).buffer) };
    await expect(new ImportPreviewService(parser(), repo).preview(account, changing))
      .rejects.toMatchObject({ code: "FILE_SIZE_MISMATCH" });
    expect(repo.findBatchByAccountAndSha256).not.toHaveBeenCalled();
  });
});
