import { describe, it, expect } from "vitest";
import { DB_CONNECTION_STRING } from "./client";

describe("infrastructure/database/client", () => {
  describe("DB_CONNECTION_STRING", () => {
    it("should start with the sqlite: prefix", () => {
      expect(DB_CONNECTION_STRING.startsWith("sqlite:")).toBe(true);
    });

    it("should use a relative path and not an absolute Windows/UNIX path", () => {
      const pathPart = DB_CONNECTION_STRING.slice(7); // remove 'sqlite:'
      
      // Should not start with forward slash (UNIX absolute)
      expect(pathPart.startsWith("/")).toBe(false);
      // Should not start with drive letter (Windows absolute, e.g. C:\)
      expect(/^[a-zA-Z]:\\/.test(pathPart)).toBe(false);
      // Should not start with drive letter with forward slash (e.g. C:/)
      expect(/^[a-zA-Z]:\//.test(pathPart)).toBe(false);
      // Should not start with UNC path (Windows share)
      expect(pathPart.startsWith("\\\\")).toBe(false);
    });

    it("should target the correct database file path", () => {
      expect(DB_CONNECTION_STRING).toBe("sqlite:database/journal.db");
    });
  });
});
