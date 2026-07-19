import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InitializationFailureScreen } from "./InitializationFailureScreen";

describe("InitializationFailureScreen", () => {
  it("shows safe recovery guidance without technical details", () => {
    const retry = vi.fn();
    render(<InitializationFailureScreen onRetry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Không thể mở cơ sở dữ liệu");
    expect(screen.queryByText(/sqlite|journal\.db|stack/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử Lại" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
