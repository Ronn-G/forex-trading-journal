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
  filename: "synthetic.csv", fileSize: 100, sourceSha256: "a".repeat(64),
  format: "VANTAGE_MT5_TRADE_HISTORY_CSV", parserVersion: "vantage-mt5-trade-history-csv@1",
  timezone: "Asia/Ho_Chi_Minh", duplicateFile: false,
  metadata: { loginMasked: "***5678", currency: "USD", server: "VantageMarkets-Live 13",
    environment: "REAL", accountMode: "HEDGE", generatedAtOriginal: null },
  counts: { totalRows: 10, positions: 3, orders: 1, deals: 1, results: 1,
    valid: 4, duplicate: 0, warning: 1, error: 0, estimatedTrades: 2 },
  issues: [{ code: "OPEN_POSITION", severity: "WARNING", section: "POSITIONS",
    rowNumber: 8, field: "Close Time", message: "Open position is excluded." }],
};
const renderScreen = (
  accounts: Account[],
  previewFn = vi.fn().mockResolvedValue(preview),
) => {
  const accountService = { list: vi.fn().mockResolvedValue(accounts) };
  render(<MemoryRouter><ImportScreen accountService={accountService} previewService={{ preview: previewFn }} /></MemoryRouter>);
  return { accountService, previewFn };
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
    expect(screen.queryByRole("button", { name: /tiếp tục nhập|import/i })).not.toBeInTheDocument();
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
});

describe("import route and navigation", () => {
  it("registers /import and displays the Nhập MT5 navigation link", () => {
    const childPaths = router.routes.flatMap((route) => route.children?.map((child) => child.path) ?? []);
    expect(childPaths).toContain("/import");
    render(<MemoryRouter initialEntries={["/import"]}><AppShell /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /nhập mt5/i })).toHaveAttribute("href", "/import");
  });
});
