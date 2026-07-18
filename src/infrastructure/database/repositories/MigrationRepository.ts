import Database from "@tauri-apps/plugin-sql";
import { getDatabaseConnection } from "../client";

export interface AppliedMigration {
  version: number;
  name: string;
  checksum: string;
  applied_at: number;
}

export interface SystemConfig {
  key: string;
  value: string;
  updated_at: number;
}

export class MigrationRepository {
  private async getDb(): Promise<Database> {
    return await getDatabaseConnection();
  }

  async getAppliedMigrations(): Promise<AppliedMigration[]> {
    const db = await this.getDb();
    return await db.select<AppliedMigration[]>(
      "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC"
    );
  }

  async getLatestAppliedVersion(): Promise<number | null> {
    const db = await this.getDb();
    const rows = await db.select<{ version: number }[]>(
      "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1"
    );
    return rows.length > 0 ? rows[0].version : null;
  }

  async getSystemConfig(key: string): Promise<SystemConfig | null> {
    const db = await this.getDb();
    const rows = await db.select<SystemConfig[]>(
      "SELECT key, value, updated_at FROM system_config WHERE key = $1",
      [key]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async setSystemConfig(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    await db.execute(
      "INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, $3) " +
      "ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
      [key, value, now]
    );
  }
}
