import { describe, expect, it, vi } from "vitest";
import { SqlImportReadRepository } from "./SqlImportReadRepository";

function setup(rowsByCall: Array<Array<{ external_id: string }>> = []) {
  const select = vi.fn()
    .mockImplementation((_sql: string, _parameters: unknown[]) =>
      Promise.resolve(rowsByCall.shift() ?? []));
  const provider = vi.fn().mockResolvedValue({ select });
  return { repository: new SqlImportReadRepository(provider), provider, select };
}

describe("SqlImportReadRepository ID lookups", () => {
  it("does not open or query the database for empty IDs", async () => {
    const { repository, provider, select } = setup();
    expect(await repository.findExistingPositionIds("account-a", ["", "  "])).toEqual(new Set());
    expect(provider).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("trims, removes empty IDs, and deduplicates input", async () => {
    const { repository, select } = setup([[{ external_id: "p1" }]]);
    expect(await repository.findExistingPositionIds("account-a", ["p1", " p1 ", "", "p2"]))
      .toEqual(new Set(["p1"]));
    expect(select).toHaveBeenCalledTimes(1);
    expect(select.mock.calls[0][1]).toEqual(["account-a", "POSITION", "p1", "p2"]);
  });

  it("chunks more than 500 IDs and merges all query results", async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `id-${index}`);
    const { repository, select } = setup([
      [{ external_id: "id-1" }], [{ external_id: "id-600" }], [{ external_id: "id-1000" }],
    ]);
    expect(await repository.findExistingDealIds("account-a", ids))
      .toEqual(new Set(["id-1", "id-600", "id-1000"]));
    expect(select).toHaveBeenCalledTimes(3);
    expect(select.mock.calls.map((call) => call[1].length)).toEqual([502, 502, 3]);
    for (const [sql, parameters] of select.mock.calls) {
      expect(sql).toContain("account_id = $1");
      expect(sql).toContain("record_type = $2");
      expect(parameters[0]).toBe("account-a");
      expect(parameters[1]).toBe("DEAL");
      expect(parameters.length - 2).toBeLessThanOrEqual(500);
    }
  });

  it.each([
    ["findExistingPositionIds", "POSITION"],
    ["findExistingOrderIds", "ORDER"],
    ["findExistingDealIds", "DEAL"],
  ] as const)("keeps account and record type scoped for %s", async (method, recordType) => {
    const { repository, select } = setup();
    await repository[method]("account-z", ["one"]);
    expect(select.mock.calls[0][1]).toEqual(["account-z", recordType, "one"]);
  });
});
