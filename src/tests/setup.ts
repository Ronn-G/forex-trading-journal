import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Tauri core API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock Tauri SQL plugin
vi.mock("@tauri-apps/plugin-sql", () => {
  return {
    default: class MockDatabase {
      static load = vi.fn().mockResolvedValue(new MockDatabase());
      execute = vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 });
      select = vi.fn().mockResolvedValue([]);
    }
  };
});
