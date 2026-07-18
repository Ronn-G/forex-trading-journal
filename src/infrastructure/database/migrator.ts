import Database from "@tauri-apps/plugin-sql";
import { MigrationError } from "../../shared/errors";
import initialSql from "./migrations/0001_initial.sql?raw";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  { version: 1, name: "0001_initial", sql: initialSql },
];

/**
 * Tính toán checksum SHA-256 cho chuỗi văn bản.
 * Sử dụng Web Crypto API có sẵn trong WebView.
 */
export async function calculateChecksum(text: string): Promise<string> {
  // Chuẩn hóa ký tự xuống dòng (\r\n thành \n) để tránh lệch checksum giữa các hệ điều hành (Windows vs Unix)
  const normalizedText = text.replace(/\r\n/g, "\n").trim();
  const msgBuffer = new TextEncoder().encode(normalizedText);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Tách chuỗi SQL thành các câu lệnh riêng biệt dựa trên dấu chấm phẩy
 */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
}

interface AppliedMigrationRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: number;
}

export async function runMigrations(db: Database): Promise<void> {
  try {
    // 1. Đảm bảo bảng schema_migrations luôn tồn tại
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);

    // 2. Đọc các migration đã áp dụng từ database
    const appliedRows = await db.select<AppliedMigrationRow[]>(
      "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC"
    );

    const appliedMap = new Map<number, AppliedMigrationRow>();
    for (const row of appliedRows) {
      appliedMap.set(row.version, row);
    }

    // 3. Duyệt qua tất cả migration được định nghĩa trong code
    for (const migration of MIGRATIONS) {
      const currentChecksum = await calculateChecksum(migration.sql);
      const applied = appliedMap.get(migration.version);

      if (applied) {
        // Kiểm tra checksum của migration cũ
        if (applied.checksum !== currentChecksum) {
          throw new MigrationError(
            `Migration checksum mismatch at version ${migration.version} (${migration.name}). ` +
            `Expected: ${currentChecksum}, Database has: ${applied.checksum}`
          );
        }
      } else {
        // Áp dụng migration mới
        console.log(`Applying migration version ${migration.version}: ${migration.name}`);
        
        const statements = splitSqlStatements(migration.sql);
        
        // Thực thi trong transaction thủ công
        await db.execute("BEGIN TRANSACTION;");
        
        try {
          for (const statement of statements) {
            await db.execute(statement);
          }
          
          // Ghi nhận vào bảng schema_migrations
          await db.execute(
            "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES ($1, $2, $3, $4)",
            [migration.version, migration.name, currentChecksum, Date.now()]
          );
          
          await db.execute("COMMIT;");
        } catch (execError) {
          await db.execute("ROLLBACK;");
          throw new MigrationError(
            `Failed to execute migration version ${migration.version} (${migration.name})`,
            execError
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof MigrationError) {
      throw error;
    }
    throw new MigrationError("Migration runner failed", error);
  }
}
