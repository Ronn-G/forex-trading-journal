import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountService } from "../../application/accounts/AccountService";
import type { Account, CreateAccountInput, UpdateAccountInput } from "../../domain/accounts/account";
import type {
  AccountArchiveFilter,
  AccountRepository,
} from "../../domain/accounts/AccountRepository";
import { AccountsScreen } from "./AccountsScreen";

class MemoryAccountRepository implements AccountRepository {
  accounts: Account[] = [];
  listError = false;
  listGate: Promise<void> | null = null;

  async list(filter: AccountArchiveFilter) {
    if (this.listGate) await this.listGate;
    if (this.listError) throw new Error("database unavailable");
    return this.accounts.filter((account) => account.isArchived === (filter === "archived"));
  }

  async findById(id: string) {
    return this.accounts.find((account) => account.id === id) ?? null;
  }

  async findDuplicate(broker: string, server: string, loginMasked: string, excludingId?: string) {
    const identity = [broker, server, loginMasked].map((value) => value.trim().toLowerCase());
    return (
      this.accounts.find(
        (account) =>
          account.id !== excludingId &&
          [account.broker, account.server, account.loginMasked]
            .map((value) => value.trim().toLowerCase())
            .every((value, index) => value === identity[index]),
      ) ?? null
    );
  }

  async create(id: string, input: CreateAccountInput, timestamp: number) {
    const account = {
      id,
      ...input,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.accounts.push(account);
    return account;
  }

  async update(input: UpdateAccountInput, timestamp: number) {
    const current = await this.findById(input.id);
    if (!current) throw new Error("not found");
    const updated = { ...current, ...input, updatedAt: timestamp };
    this.accounts = this.accounts.map((account) =>
      account.id === input.id ? updated : account,
    );
    return updated;
  }

  async setArchived(id: string, isArchived: boolean, timestamp: number) {
    const current = await this.findById(id);
    if (!current) throw new Error("not found");
    const updated = { ...current, isArchived, updatedAt: timestamp };
    this.accounts = this.accounts.map((account) => (account.id === id ? updated : account));
    return updated;
  }
}

function setup(repository = new MemoryAccountRepository()) {
  let id = 0;
  const service = new AccountService(repository, () => 100, () => `account-${++id}`);
  render(<AccountsScreen service={service} />);
  return repository;
}

function fillValidForm(name = "Main") {
  fireEvent.change(screen.getByLabelText(/^Tên hiển thị/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/^Broker/), { target: { value: "Vantage" } });
  fireEvent.change(screen.getByLabelText(/^Server/), { target: { value: "Live 13" } });
  fireEvent.change(screen.getByLabelText(/^Login đã che/), { target: { value: "***1234" } });
}

describe("AccountsScreen", () => {
  it("shows loading and then the active empty state", async () => {
    let release = () => {};
    const repository = new MemoryAccountRepository();
    repository.listGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setup(repository);
    expect(screen.getByRole("heading", { name: "Tài Khoản Giao Dịch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang hoạt động" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đã lưu trữ" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    release();
    expect(await screen.findByText("Chưa có tài khoản")).toBeInTheDocument();
  });

  it("shows a recoverable database error", async () => {
    const repository = new MemoryAccountRepository();
    repository.listError = true;
    setup(repository);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải");
  });

  it("shows field validation and creates a valid account", async () => {
    setup();
    await screen.findByText("Chưa có tài khoản");
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(screen.getByLabelText(/^Tên hiển thị/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu tài khoản" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Lưu tài khoản" }));
    expect(await screen.findByText("Main")).toBeInTheDocument();
  });

  it("edits, archives, filters, and restores an account", async () => {
    const repository = new MemoryAccountRepository();
    repository.accounts = [{
      id: "account-1",
      name: "Main",
      broker: "Vantage",
      server: "Live 13",
      loginMasked: "***1234",
      accountCurrency: "USD",
      accountType: "Hedge",
      timezone: "Asia/Ho_Chi_Minh",
      isDemo: false,
      isArchived: false,
      createdAt: 1,
      updatedAt: 1,
    }];
    setup(repository);
    await screen.findByText("Main");

    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "Primary" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu tài khoản" }));
    expect(await screen.findByText("Primary")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lưu trữ" }));
    await waitFor(() => expect(screen.getByText("Chưa có tài khoản")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Đã lưu trữ" }));
    expect(await screen.findByText("Primary")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));
    await waitFor(() =>
      expect(screen.getByText("Chưa có tài khoản lưu trữ")).toBeInTheDocument(),
    );
  });
});
