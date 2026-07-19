import { describe, expect, it, vi } from "vitest";
import { SqlTradeRepository } from "./SqlTradeRepository";

const row = {
  id: "t1", account_id: "a", source_type: "MT5_POSITION" as const, source_position_id: "p1",
  import_batch_id: "b1", symbol: "EURUSD", side: "BUY" as const, volume: "0.10",
  opened_at: 1, closed_at: 2, original_opened_at: "open", original_closed_at: "close",
  open_price: "1.1", close_price: "1.2", stop_loss: null, take_profit: null,
  commission: "-2.00", swap: "-0.25", gross_profit: "10.50", net_profit: "8.25",
  duration_ms: 1, status: "CLOSED" as const,
};
describe("SqlTradeRepository", () => {
  it("lists account-scoped trades with parameterized filters, pagination and preserved decimals", async () => {
    const select = vi.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([{ total: 1 }]);
    const page = await new SqlTradeRepository(async () => ({ select })).listByAccount({
      accountId: "a", limit: 20, offset: 5, symbol: "EUR", side: "BUY",
      dateFrom: 1, dateTo: 2, sort: "CLOSED_DESC",
    });
    expect(page.items[0].netProfit).toBe("8.25");
    expect(page.total).toBe(1);
    const [sql, params] = select.mock.calls[0];
    expect(sql).toContain("account_id = $1");
    expect(sql).toContain("ORDER BY closed_at DESC, id ASC");
    expect(params).toEqual(["a", "%EUR%", "BUY", 1, 2, 20, 5]);
    expect(sql).not.toContain("EUR");
  });
  it.each([
    ["' OR 1=1 --", "%' OR 1=1 --%"],
    ["%", "%\\%%"],
    ["_", "%\\_%"],
    ["\\", "%\\\\%"],
    ["日経", "%日経%"],
  ])("treats symbol search %s as a parameterized literal", async (symbol, expected) => {
    const select = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    await new SqlTradeRepository(async () => ({ select })).listByAccount({
      accountId: "account-a", limit: 20, offset: 0, symbol, sort: "CLOSED_DESC",
    });
    const [sql, params] = select.mock.calls[0];
    expect(sql).toContain("account_id = $1");
    expect(sql).toContain("symbol LIKE $2 ESCAPE '\\'");
    expect(params).toEqual(["account-a", expected, 20, 0]);
  });
  it("rejects malformed rows", async () => {
    const select = vi.fn().mockResolvedValueOnce([{ ...row, side: "BAD" }]).mockResolvedValueOnce([{ total: 1 }]);
    await expect(new SqlTradeRepository(async () => ({ select })).listByAccount({
      accountId: "a", limit: 50, offset: 0, sort: "CLOSED_DESC",
    })).rejects.toThrow("Malformed trade row");
  });
});
