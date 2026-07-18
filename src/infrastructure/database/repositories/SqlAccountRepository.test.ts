import { describe, expect, it, vi } from "vitest";
import { DatabaseError } from "../../../shared/errors";
import { SqlAccountRepository } from "./SqlAccountRepository";

const row = {
  id: "account-1",
  name: "Main",
  broker: "Vantage",
  server: "Live 13",
  login_masked: "***1234",
  account_currency: "USD",
  account_type: "Hedge",
  timezone: "Asia/Ho_Chi_Minh",
  is_demo: 0,
  is_archived: 0,
  created_at: 100,
  updated_at: 100,
};

describe("SqlAccountRepository", () => {
  it("uses a parameterized archive filter and maps database rows", async () => {
    const db = {
      select: vi.fn().mockResolvedValue([row]),
      execute: vi.fn(),
    };
    const repository = new SqlAccountRepository(async () => db);
    const accounts = await repository.list("active");
    expect(db.select).toHaveBeenCalledWith(expect.stringContaining("is_archived = $1"), [0]);
    expect(accounts[0]).toMatchObject({
      id: "account-1",
      loginMasked: "***1234",
      isDemo: false,
      isArchived: false,
    });
  });

  it("creates with parameterized SQL and never stores credentials", async () => {
    const db = {
      select: vi.fn(),
      execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
    };
    const repository = new SqlAccountRepository(async () => db);
    await repository.create(
      "account-1",
      {
        name: "Main",
        broker: "Vantage",
        server: "Live 13",
        loginMasked: "***1234",
        accountCurrency: "USD",
        accountType: "Hedge",
        timezone: "Asia/Ho_Chi_Minh",
        isDemo: false,
      },
      100,
    );
    const [sql, parameters] = db.execute.mock.calls[0];
    expect(sql).toContain("VALUES ($1, $2");
    expect(sql).not.toMatch(/password|api_key|token/i);
    expect(parameters).toContain("***1234");
  });

  it("performs archive as UPDATE and exposes no hard-delete method", async () => {
    const db = {
      select: vi.fn().mockResolvedValue([{ ...row, is_archived: 1 }]),
      execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
    };
    const repository = new SqlAccountRepository(async () => db);
    await repository.setArchived("account-1", true, 200);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringMatching(/^UPDATE accounts/),
      ["account-1", 1, 200],
    );
    expect("delete" in repository).toBe(false);
  });

  it("wraps driver failures as DatabaseError", async () => {
    const repository = new SqlAccountRepository(async () => ({
      select: vi.fn().mockRejectedValue(new Error("locked")),
      execute: vi.fn(),
    }));
    await expect(repository.list("active")).rejects.toBeInstanceOf(DatabaseError);
  });
});
