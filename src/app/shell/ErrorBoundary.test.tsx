import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// Component con giả lập crash khi render
const BuggyComponent: React.FC = () => {
  throw new Error("Test render error");
};

describe("app/shell/ErrorBoundary", () => {
  it("should catch render errors and display fallback UI", () => {
    // Tắt ghi log console.error tạm thời để tránh rác log trong lúc test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    // Kiểm tra xem giao diện fallback của Error Boundary có render không
    expect(screen.getByText("Đã Xảy Ra Lỗi Giao Diện")).toBeInTheDocument();
    expect(screen.getAllByText(/Test render error/).length).toBeGreaterThan(0);
    expect(screen.getByText("Tải Lại Giao Diện")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
