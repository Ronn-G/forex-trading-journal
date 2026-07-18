import Database from "@tauri-apps/plugin-sql";
import { DatabaseError } from "../../shared/errors";

let dbInstance: Database | null = null;

export const DB_CONNECTION_STRING = "sqlite:database/journal.db";

export async function getDatabaseConnection(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Kết nối SQLite lưu tại <app_data_dir>/database/journal.db
    const db = await Database.load(DB_CONNECTION_STRING);
    
    // Bật foreign key constraints
    await db.execute("PRAGMA foreign_keys = ON;");
    
    dbInstance = db;
    return db;
  } catch (error) {
    console.error("Database connection failed:", error);
    const originalMessage = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Failed to connect to SQLite database: ${originalMessage}`, error);
  }
}
