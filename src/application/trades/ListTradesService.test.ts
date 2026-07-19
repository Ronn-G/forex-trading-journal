import { describe, expect, it, vi } from "vitest";
import type { TradeRepository } from "../../domain/trades/TradeRepository";
import { ListTradesService } from "./ListTradesService";

describe("ListTradesService", () => {
  it("normalizes a valid query and returns repository data", async () => {
    const repository: TradeRepository = { listByAccount: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }) };
    await new ListTradesService(repository).execute({ accountId: " a ", symbol: " EUR " });
    expect(repository.listByAccount).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "a", symbol: "EUR", limit: 50, offset: 0, sort: "CLOSED_DESC",
    }));
  });
  it.each([
    [{ accountId: "" }],
    [{ accountId: "a", limit: 201 }],
    [{ accountId: "a", offset: -1 }],
    [{ accountId: "a", dateFrom: 2, dateTo: 1 }],
    [{ accountId: "a", side: "HOLD" as never }],
    [{ accountId: "a", sort: "RAW_SQL" as never }],
    [{ accountId: "a", dateFrom: Number.NaN }],
    [{ accountId: "a", dateTo: 1.5 }],
    [{ accountId: "a", symbol: "X".repeat(65) }],
  ])("rejects invalid query %#", async (query) => {
    await expect(new ListTradesService({ listByAccount: vi.fn() }).execute(query))
      .rejects.toMatchObject({ name: "TradeQueryError" });
  });
  it("maps repository failures safely", async () => {
    const service = new ListTradesService({ listByAccount: vi.fn().mockRejectedValue(new Error("SQL path")) });
    await expect(service.execute({ accountId: "a" })).rejects.toMatchObject({
      name: "TradeListError", message: "Không thể tải danh sách giao dịch.",
    });
  });
});
