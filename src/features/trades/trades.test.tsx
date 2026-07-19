import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { router } from "../../app/router";
import { AppShell } from "../../app/shell/AppShell";
import type { Account } from "../../domain/accounts/account";
import type { Trade } from "../../domain/trades/trade";
import { TradesScreen, formatDuration } from "./TradesScreen";

const account: Account = { id: "a", name: "Alpha", broker: "V", server: "S", loginMasked: "***1",
  accountCurrency: "USD", accountType: "Hedge", timezone: "UTC", isDemo: false, isArchived: false,
  createdAt: 1, updatedAt: 1 };
const trade: Trade = { id: "t", accountId: "a", sourceType: "MT5_POSITION", sourcePositionId: "p",
  importBatchId: "b", symbol: "EURUSD", side: "BUY", volume: "0.1", openedAt: 0, closedAt: 3_600_000,
  originalOpenedAt: "o", originalClosedAt: "c", openPrice: "1.1", closePrice: "1.2",
  stopLoss: null, takeProfit: null, commission: "-2.00", swap: "-0.25", grossProfit: "10.50",
  netProfit: "8.25", durationMs: 3_600_000, status: "CLOSED" };
const accountService = { list: vi.fn().mockImplementation((filter: string) => Promise.resolve(filter === "active" ? [account] : [])) };

describe("TradesScreen", () => {
  it("renders trades, filters and loads more without edit controls", async () => {
    const execute = vi.fn().mockResolvedValue({ items: [trade], total: 2, limit: 50, offset: 0 });
    render(<MemoryRouter><TradesScreen accountService={accountService} tradeService={{ execute }} /></MemoryRouter>);
    expect((await screen.findAllByText("EURUSD")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("BUY").length).toBeGreaterThan(0);
    expect(screen.getAllByText("8.25").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /edit|sửa/i })).not.toBeInTheDocument();
    const filterButton = screen.getByRole("button", { name: "Lọc" });
    expect(filterButton).toHaveAttribute("type", "submit");
    expect(filterButton).toBeEnabled();
    const initialCalls = execute.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Symbol"), { target: { value: "EUR" } });
    fireEvent.change(screen.getByLabelText("Side"), { target: { value: "SELL" } });
    expect(execute).toHaveBeenCalledTimes(initialCalls);
    fireEvent.click(filterButton);
    await waitFor(() => expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: "EUR", side: "SELL", offset: 0 })));
    fireEvent.change(screen.getByLabelText("Symbol"), { target: { value: "GBP" } });
    fireEvent.click(screen.getByRole("button", { name: "Tải thêm" }));
    await waitFor(() => expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1, symbol: "EUR", side: "SELL" })));
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    await waitFor(() => expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({
      offset: 0, symbol: undefined, side: undefined,
    })));
  });
  it("shows empty state and import CTA", async () => {
    render(<MemoryRouter><TradesScreen accountService={accountService}
      tradeService={{ execute: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }) }} /></MemoryRouter>);
    expect(await screen.findByText("Chưa có giao dịch nào. Hãy nhập báo cáo MT5 để bắt đầu.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nhập báo cáo MT5" })).toHaveAttribute("href", "/import");
  });
  it("shows safe error and retry", async () => {
    render(<MemoryRouter><TradesScreen accountService={accountService}
      tradeService={{ execute: vi.fn().mockRejectedValue(new Error("SQL database path")) }} /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải danh sách giao dịch.");
    expect(screen.queryByText(/SQL database path/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });
  it("ignores a stale account response after switching accounts", async () => {
    const beta = { ...account, id: "b", name: "Beta" };
    const betaTrade = { ...trade, id: "tb", accountId: "b", symbol: "GBPUSD" };
    let resolveAlpha!: (value: unknown) => void;
    const alphaPending = new Promise((resolve) => { resolveAlpha = resolve; });
    const execute = vi.fn().mockImplementation(({ accountId }: { accountId: string }) =>
      accountId === "a" ? alphaPending : Promise.resolve({ items: [betaTrade], total: 1, limit: 50, offset: 0 }));
    const accounts = { list: vi.fn().mockImplementation((filter: string) =>
      Promise.resolve(filter === "active" ? [account, beta] : [])) };
    render(<MemoryRouter><TradesScreen accountService={accounts} tradeService={{ execute }} /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Tài khoản"), { target: { value: "b" } });
    expect((await screen.findAllByText("GBPUSD")).length).toBeGreaterThan(0);
    await act(async () => resolveAlpha({ items: [trade], total: 1, limit: 50, offset: 0 }));
    expect(screen.queryByText("EURUSD")).not.toBeInTheDocument();
    expect(screen.getAllByText("GBPUSD").length).toBeGreaterThan(0);
  });
  it("retries account loading before loading trades", async () => {
    let activeCalls = 0;
    const accounts = { list: vi.fn().mockImplementation((filter: string) => {
      if (filter === "archived") return Promise.resolve([]);
      activeCalls += 1;
      return activeCalls === 1 ? Promise.reject(new Error("accounts unavailable")) : Promise.resolve([account]);
    }) };
    const execute = vi.fn().mockResolvedValue({ items: [trade], total: 1, limit: 50, offset: 0 });
    render(<MemoryRouter><TradesScreen accountService={accounts} tradeService={{ execute }} /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải tài khoản.");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect((await screen.findAllByText("EURUSD")).length).toBeGreaterThan(0);
    expect(activeCalls).toBe(2);
  });
  it("submits trimmed filters with Enter and prevents double submit while loading", async () => {
    let resolve!: (value: unknown) => void;
    const execute = vi.fn()
      .mockResolvedValueOnce({ items: [trade], total: 1, limit: 50, offset: 0 })
      .mockReturnValueOnce(new Promise((done) => { resolve = done; }))
      .mockResolvedValue({ items: [trade], total: 1, limit: 50, offset: 0 });
    render(<MemoryRouter><TradesScreen accountService={accountService} tradeService={{ execute }} /></MemoryRouter>);
    await screen.findAllByText("EURUSD");
    const symbol = screen.getByLabelText("Symbol");
    fireEvent.change(symbol, { target: { value: "  EURUSD  " } });
    const form = symbol.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!); fireEvent.submit(form!);
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: "EURUSD", offset: 0 }));
    expect(screen.getByRole("button", { name: "Lọc" })).toBeDisabled();
    await act(async () => resolve({ items: [trade], total: 1, limit: 50, offset: 0 }));
    expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled();
    fireEvent.submit(form!);
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(3));
  });
  it("renders aligned desktop headers and labeled mobile values", async () => {
    render(<MemoryRouter><TradesScreen accountService={accountService}
      tradeService={{ execute: vi.fn().mockResolvedValue({ items: [trade], total: 1, limit: 50, offset: 0 }) }} /></MemoryRouter>);
    await screen.findAllByText("EURUSD");
    const headings = ["Đóng lúc", "Mã", "Lệnh", "Khối lượng", "Giá mở", "Giá đóng",
      "Phí", "Swap", "Lãi gộp", "Lãi ròng", "Thời lượng"];
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(headings);
    const rows = screen.getAllByRole("row");
    const cells = Array.from(rows[1].querySelectorAll("td"));
    expect(cells).toHaveLength(11);
    expect(cells[8]).toHaveTextContent("10.50");
    expect(cells[9]).toHaveTextContent("8.25");
    expect(cells[10]).toHaveTextContent("1 giờ 0 phút");
    for (const label of ["Đóng lúc", "Khối lượng", "Giá mở", "Giá đóng", "Phí", "Swap", "Lãi gộp", "Lãi ròng", "Thời lượng"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
  it("registers route/navigation and formats duration", () => {
    expect(router.routes.flatMap((item) => item.children?.map((child) => child.path) ?? [])).toContain("/trades");
    render(<MemoryRouter initialEntries={["/trades"]}><AppShell /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Giao Dịch" })).toHaveAttribute("href", "/trades");
    expect(formatDuration(45_000)).toBe("45 giây"); expect(formatDuration(8_100_000)).toBe("2 giờ 15 phút");
  });
});
