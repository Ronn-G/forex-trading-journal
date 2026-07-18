import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateChecksum, splitSqlStatements, runMigrations, MIGRATIONS } from "./migrator";
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

  it("registers the accounts migration with required constraints and no secrets", () => {
    expect(MIGRATIONS.map(({ version, name }) => ({ version, name }))).toEqual([
      { version: 1, name: "0001_initial" },
      { version: 2, name: "0002_accounts" },
      { version: 3, name: "0003_import_foundation" },
      { version: 4, name: "0004_mt5_entities" },
    ]);

    const accountsMigration = MIGRATIONS[1];
    expect(accountsMigration.sql).toContain("CREATE TABLE accounts");
    expect(accountsMigration.sql).toContain("CHECK (is_demo IN (0, 1))");
    expect(accountsMigration.sql).toContain("CHECK (is_archived IN (0, 1))");
    expect(accountsMigration.sql).toContain("CREATE INDEX idx_accounts_archived_name");
    expect(accountsMigration.sql).toContain("CREATE INDEX idx_accounts_broker_server");
    expect(accountsMigration.sql).not.toMatch(/password|api[_ ]?key|token/i);
  });

  it("registers migration 0004 without normalized trade tables or floating financial storage", () => {
    const migration = MIGRATIONS[3];
    expect(migration.sql).toContain("CREATE TABLE mt5_positions");
    expect(migration.sql).toContain("CREATE TABLE mt5_orders");
    expect(migration.sql).toContain("CREATE TABLE mt5_deals");
    expect(migration.sql).toContain("UNIQUE(account_id, external_position_id)");
    expect(migration.sql).toContain("UNIQUE(account_id, external_order_id)");
    expect(migration.sql).toContain("UNIQUE(account_id, external_deal_id)");
    expect(migration.sql).toContain("status <> 'CLOSED'");
    expect(migration.sql).toMatch(/CREATE INDEX idx_mt5_positions_batch/);
    expect(migration.sql).toMatch(/CREATE INDEX idx_mt5_orders_batch/);
    expect(migration.sql).toMatch(/CREATE INDEX idx_mt5_deals_batch/);
    expect(migration.sql).not.toMatch(/\bREAL\b|\bFLOAT\b/i);
    expect(migration.sql).not.toMatch(/CREATE TABLE trades/i);
    expect(migration.sql).not.toMatch(/password|api[_ ]?key|token/i);
  });

  it("registers migration 0003 with import foundation constraints and indexes", () => {
    const migration = MIGRATIONS[2];
    expect(migration.version).toBeGreaterThan(MIGRATIONS[1].version);
    expect(migration.sql).toMatch(/CREATE TABLE import_batches/i);
    expect(migration.sql).toMatch(/CREATE TABLE raw_mt5_records/i);
    expect(migration.sql).toMatch(/account_id TEXT NOT NULL REFERENCES accounts\(id\)/i);
    expect(migration.sql).toMatch(/import_batch_id TEXT NOT NULL REFERENCES import_batches\(id\)/i);
    expect(migration.sql).toMatch(/UNIQUE\(account_id, source_sha256\)/i);
    expect(migration.sql).toMatch(/UNIQUE\(import_batch_id, record_type, row_number\)/i);
    expect(migration.sql).toMatch(/UNIQUE\(account_id, record_type, external_id\)/i);
    expect(migration.sql).toMatch(/CHECK\s*\(\s*status IN\s*\(/i);
    expect(migration.sql).toMatch(/CREATE INDEX idx_import_batches_account_started/i);
    expect(migration.sql).toMatch(/CREATE INDEX idx_raw_mt5_records_batch/i);
    expect(migration.sql).toMatch(/CREATE INDEX idx_raw_mt5_records_account_type/i);
    expect(migration.sql).not.toMatch(/password|api[_ ]?key|token/i);
  });

  it("applies the mocked upgrade path in version order 1 then 2 then 3", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
      select: vi.fn().mockResolvedValue([]),
    } as unknown as Database;
    await runMigrations(mockDb);
    const inserts = vi.mocked(mockDb.execute).mock.calls
      .filter(([sql]) => typeof sql === "string" && sql.startsWith("INSERT INTO schema_migrations"))
      .map(([, parameters]) => (parameters as unknown[])[0]);
    expect(inserts).toEqual([1, 2, 3, 4]);
  });

  it("does not run migrations that are already applied", async () => {
    const appliedRows = await Promise.all(
      MIGRATIONS.map(async (migration) => ({
        version: migration.version,
        name: migration.name,
        checksum: await calculateChecksum(migration.sql),
        applied_at: Date.now(),
      })),
    );
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
      select: vi.fn().mockResolvedValue(appliedRows),
    } as unknown as Database;

    await runMigrations(mockDb);

    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS schema_migrations"),
    );
    expect(mockDb.execute).not.toHaveBeenCalledWith("BEGIN TRANSACTION;");
  });
});
