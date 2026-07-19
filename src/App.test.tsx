import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { getDatabaseConnection, runMigrations, invoke } = vi.hoisted(() => ({
  getDatabaseConnection: vi.fn(),
  runMigrations: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("./infrastructure/database/client", () => ({ getDatabaseConnection }));
vi.mock("./infrastructure/database/migrator", () => ({ runMigrations }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("./app/router", () => ({ router: {} }));
vi.mock("react-router-dom", () => ({
  RouterProvider: () => <main>APP_READY</main>,
}));

describe("App initialization orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDatabaseConnection.mockResolvedValue({ execute: vi.fn(), select: vi.fn() });
    runMigrations.mockResolvedValue(undefined);
    invoke.mockResolvedValue(0);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("runs migrations before backfill and renders only after both succeed", async () => {
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang khởi tạo");
    await screen.findByText("APP_READY");
    expect(runMigrations.mock.invocationCallOrder[0]).toBeLessThan(invoke.mock.invocationCallOrder[0]);
    expect(invoke).toHaveBeenCalledWith("backfill_missing_trades");
  });

  it("does not backfill after migration failure and hides technical details", async () => {
    runMigrations.mockRejectedValueOnce(new Error("SQL C:\\private\\journal.db stack"));
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không thể mở cơ sở dữ liệu");
    expect(screen.queryByText(/private|journal\.db|stack|SQL/)).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps the app unavailable after backfill failure then retries successfully", async () => {
    invoke.mockRejectedValueOnce(new Error("sqlite raw failure")).mockResolvedValueOnce(0);
    render(<App />);
    await screen.findByRole("alert");
    expect(screen.queryByText("APP_READY")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử Lại" }));
    await screen.findByText("APP_READY");
    expect(runMigrations).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not start concurrent initialization while the first run is pending", async () => {
    let finish!: () => void;
    runMigrations.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<App />);
    await waitFor(() => expect(runMigrations).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: "Thử Lại" })).not.toBeInTheDocument();
    finish();
    await screen.findByText("APP_READY");
    expect(runMigrations).toHaveBeenCalledOnce();
  });
});
