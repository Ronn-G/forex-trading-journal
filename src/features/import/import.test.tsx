import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { router } from "../../app/router";
import { AppShell } from "../../app/shell/AppShell";
import { ImportPreviewError } from "../../application/import/ImportPreviewService";
import type { Account } from "../../domain/accounts/account";
import type { ImportPreview } from "../../domain/import/import";
import { ImportScreen } from "./ImportScreen";

const account = (id: string, name: string): Account => ({
  id, name, broker: "Vantage", server: "VantageMarkets-Live 13", loginMasked: "***5678",
  accountCurrency: "USD", accountType: "Hedge", timezone: "Asia/Ho_Chi_Minh",
  isDemo: false, isArchived: false, createdAt: 1, updatedAt: 1,
});
const preview: ImportPreview = {
  accountId: "account-a",
  filename: "synthetic.csv", fileSize: 100, sourceSha256: "a".repeat(64),
  format: "VANTAGE_MT5_TRADE_HISTORY_CSV", parserVersion: "vantage-mt5-trade-history-csv@1",
  timezone: "Asia/Ho_Chi_Minh", duplicateFile: false,
  metadata: { loginMasked: "***5678", currency: "USD", server: "VantageMarkets-Live 13",
    environment: "REAL", accountMode: "HEDGE", generatedAtOriginal: null },
  counts: { totalRows: 10, positions: 3, orders: 1, deals: 1, results: 1,
    valid: 4, duplicate: 0, warning: 1, error: 0, estimatedTrades: 2 },
  issues: [{ code: "OPEN_POSITION", severity: "WARNING", section: "POSITIONS",
    rowNumber: 8, field: "Close Time", message: "Open position is excluded." }],
  prepared: {
    sourceSha256: "a".repeat(64), metadata: { loginMasked: "***5678", currency: "USD",
      server: "VantageMarkets-Live 13", environment: "REAL", accountMode: "HEDGE", generatedAtOriginal: null },
    positions: [{ rowNumber: 5, raw: {}, externalPositionId: "p1", symbol: "EURUSD", side: "BUY",
      volume: "0.1", openPrice: "1.1", stopLoss: null, takeProfit: null,
      openedAt: { original: "2026.01.01 10:00:00", epochMs: 1 },
      closePrice: "1.2", closedAt: { original: "2026.01.01 11:00:00", epochMs: 2 },
      commission: "0", swap: "0", profit: "1", valid: true, open: false }],
    orders: [], deals: [], results: [], issues: [], totalRows: 10,
  },
};
const renderScreen = (
  accounts: Account[],
  previewFn = vi.fn().mockResolvedValue(preview),
  commitFn = vi.fn().mockResolvedValue({
    batchId: "batch-123456789", rawRecordsInserted: 1, positionsInserted: 1, ordersInserted: 0,
    dealsInserted: 0, skippedDuplicates: 0, warningCount: 1, errorCount: 0, completedAt: 2,
  }),
) => {
  const accountService = { list: vi.fn().mockResolvedValue(accounts) };
  render(<MemoryRouter><ImportScreen accountService={accountService} previewService={{ preview: previewFn }}
    importService={{ commit: commitFn }} /></MemoryRouter>);
  return { accountService, previewFn, commitFn };
};

describe("ImportScreen", () => {
  it("shows no-active-account state and accounts link", async () => {
    renderScreen([]);
    expect(await screen.findByText(/cần tạo một tài khoản/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mở trang tài khoản/i })).toHaveAttribute("href", "/accounts");
  });
  it("loads active accounts and supports account selection and file picking", async () => {
    const services = renderScreen([account("a", "Alpha"), account("b", "Beta")]);
    const selector = await screen.findByRole("combobox");
    expect(services.accountService.list).toHaveBeenCalledWith("active");
    fireEvent.change(selector, { target: { value: "b" } });
    const file = new File(["synthetic"], "synthetic.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/chọn vantage/i), { target: { files: [file] } });
    await waitFor(() => expect(services.previewFn).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }), file));
  });
  it("shows parsing state then a safe preview with counts, masked login, warnings, and reset", async () => {
    let resolve!: (value: ImportPreview) => void;
    const pending = vi.fn().mockReturnValue(new Promise<ImportPreview>((done) => { resolve = done; }));
    renderScreen([account("a", "Alpha")], pending);
    await screen.findByRole("combobox");
    const file = new File(["x"], "synthetic.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/chọn vantage/i), { target: { files: [file] } });
    expect(await screen.findByRole("status")).toHaveTextContent(/phân tích/i);
    resolve(preview);
    expect(await screen.findByText(/Login: \*\*\*5678/)).toBeInTheDocument();
    expect(screen.getByText("estimatedTrades")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("WARNING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nhập dữ liệu" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /chọn file khác/i }));
    expect(await screen.findByText(/chọn vantage/i)).toBeInTheDocument();
  });
  it.each([
    ["oversized", new ImportPreviewError("FILE_TOO_LARGE", "The file exceeds the 20 MB limit.")],
    ["unsupported", new ImportPreviewError("PARSER_ERROR", "Unsupported report.")],
    ["repository", new ImportPreviewError("REPOSITORY_ERROR", "Import history could not be checked.")],
  ])("shows a safe retry state for %s failures", async (_name, error) => {
    renderScreen([account("a", "Alpha")], vi.fn().mockRejectedValue(error));
    await screen.findByRole("combobox");
    fireEvent.change(screen.getByLabelText(/chọn vantage/i), {
      target: { files: [new File(["x"], "x.csv")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(error.message);
    fireEvent.click(screen.getByRole("button", { name: /thử lại/i }));
    expect(await screen.findByText(/chọn vantage/i)).toBeInTheDocument();
  });
  it("confirms, prevents double submit, and displays a real command result", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolve!: (value: {
      batchId: string; rawRecordsInserted: number; positionsInserted: number; ordersInserted: number;
      dealsInserted: number; skippedDuplicates: number; warningCount: number; errorCount: number; completedAt: number;
    }) => void;
    const commitFn = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; }));
    renderScreen([account("a", "Alpha")], vi.fn().mockResolvedValue(preview), commitFn);
    await screen.findByRole("combobox");
    fireEvent.change(screen.getByLabelText(/chọn vantage/i), { target: { files: [new File(["x"], "x.csv")] } });
    const button = await screen.findByRole("button", { name: "Nhập dữ liệu" });
    fireEvent.click(button); fireEvent.click(button);
    expect(commitFn).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /đang nhập/i })).toBeDisabled();
    resolve({ batchId: "batch-123456789", rawRecordsInserted: 1, positionsInserted: 1, ordersInserted: 0,
      dealsInserted: 0, skippedDuplicates: 0, warningCount: 1, errorCount: 0, completedAt: 2 });
    expect(await screen.findByText(/nhập dữ liệu thành công/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /nhập file khác/i }));
    expect(await screen.findByText(/chọn vantage/i)).toBeInTheDocument();
  });
});

describe("import route and navigation", () => {
  it("registers /import and displays the Nhập MT5 navigation link", () => {
    const childPaths = router.routes.flatMap((route) => route.children?.map((child) => child.path) ?? []);
    expect(childPaths).toContain("/import");
    render(<MemoryRouter initialEntries={["/import"]}><AppShell /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /nhập mt5/i })).toHaveAttribute("href", "/import");
  });
});
