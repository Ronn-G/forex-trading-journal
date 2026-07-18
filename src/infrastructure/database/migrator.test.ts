import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateChecksum, splitSqlStatements, runMigrations } from "./migrator";
import Database from "@tauri-apps/plugin-sql";
import { MigrationError } from "../../shared/errors";

describe("infrastructure/database/migrator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should calculate checksum SHA-256 for migration script", async () => {
    const sql = "CREATE TABLE test (id INTEGER PRIMARY KEY);";
    const checksum1 = await calculateChecksum(sql);
    const checksum2 = await calculateChecksum(sql + "\r\n"); // kiểm tra chuẩn hóa dòng mới
    
    expect(checksum1).toBeDefined();
    expect(checksum1.length).toBe(64);
    expect(checksum1).toBe(checksum2);
  });

  it("should split multiple SQL statements properly", () => {
    const sql = `
      CREATE TABLE test1 (id INT);
      
      CREATE TABLE test2 (
        id INT, 
        name TEXT
      );
    `;
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBe(2);
    expect(statements[0]).toBe("CREATE TABLE test1 (id INT)");
    expect(statements[1]).toBe("CREATE TABLE test2 (\n        id INT, \n        name TEXT\n      )");
  });

  it("should run migrations and execute each sql statement in order", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
      select: vi.fn().mockResolvedValue([]), // Chưa có migration nào được áp dụng
    } as unknown as Database;

    await runMigrations(mockDb);

    // Xác nhận tạo bảng schema_migrations
    expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS schema_migrations"));
    // Xác nhận mở transaction
    expect(mockDb.execute).toHaveBeenCalledWith("BEGIN TRANSACTION;");
    // Xác nhận chạy câu lệnh trong migration
    expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS system_config"));
    // Xác nhận commit
    expect(mockDb.execute).toHaveBeenCalledWith("COMMIT;");
  });

  it("should throw MigrationError if checksum mismatch occurs", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
      select: vi.fn().mockResolvedValue([
        {
          version: 1,
          name: "0001_initial",
          checksum: "wrong_checksum_here", // sai checksum so với code
          applied_at: Date.now()
        }
      ]),
    } as unknown as Database;

    await expect(runMigrations(mockDb)).rejects.toThrow(MigrationError);
  });
});
