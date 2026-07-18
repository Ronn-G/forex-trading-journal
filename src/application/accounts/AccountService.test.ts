import { describe, expect, it, vi } from "vitest";
import type { AccountRepository } from "../../domain/accounts/AccountRepository";
import { AccountService, AccountInputError, DuplicateAccountError } from "./AccountService";

const input = {
  name: "Main",
  broker: "Vantage",
  server: "Live 13",
  loginMasked: "***1234",
  accountCurrency: "usd",
  accountType: "Hedge",
  timezone: "Asia/Ho_Chi_Minh",
  isDemo: false,
};

function repository(): AccountRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    findDuplicate: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((id, created, timestamp) =>
      Promise.resolve({
        id,
        ...created,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ),
    update: vi.fn(),
    setArchived: vi.fn(),
  };
}

describe("AccountService", () => {
  it("validates and normalizes before creating", async () => {
    const repo = repository();
    const service = new AccountService(repo, () => 100, () => "account-1");
    const account = await service.create(input);
    expect(account.accountCurrency).toBe("USD");
    expect(repo.create).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ accountCurrency: "USD" }),
      100,
    );
  });

  it("rejects invalid input before persistence", async () => {
    const repo = repository();
    const service = new AccountService(repo);
    await expect(service.create({ ...input, name: "" })).rejects.toBeInstanceOf(
      AccountInputError,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("enforces the explicit duplicate identity policy", async () => {
    const repo = repository();
    vi.mocked(repo.findDuplicate).mockResolvedValue({
      id: "existing",
      ...input,
      accountCurrency: "USD",
      isArchived: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new AccountService(repo);
    await expect(service.create(input)).rejects.toBeInstanceOf(DuplicateAccountError);
  });

  it("archives and unarchives without a delete operation", async () => {
    const repo = repository();
    const existing = {
      id: "account-1",
      ...input,
      accountCurrency: "USD",
      isArchived: false,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(repo.findById).mockResolvedValue(existing);
    vi.mocked(repo.setArchived).mockImplementation((id, archived, timestamp) =>
      Promise.resolve({ ...existing, id, isArchived: archived, updatedAt: timestamp }),
    );
    const service = new AccountService(repo, () => 200);
    expect((await service.archive("account-1")).isArchived).toBe(true);
    expect((await service.unarchive("account-1")).isArchived).toBe(false);
    expect(repo.setArchived).toHaveBeenNthCalledWith(1, "account-1", true, 200);
    expect(repo.setArchived).toHaveBeenNthCalledWith(2, "account-1", false, 200);
  });
});
