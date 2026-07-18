import type Database from "@tauri-apps/plugin-sql";
import { z } from "zod/v4";
import type {
  Account,
  CreateAccountInput,
  UpdateAccountInput,
} from "../../../domain/accounts/account";
import type {
  AccountArchiveFilter,
  AccountRepository,
} from "../../../domain/accounts/AccountRepository";
import { DatabaseError } from "../../../shared/errors";
import { getDatabaseConnection } from "../client";

interface AccountRow {
  id: string;
  name: string;
  broker: string;
  server: string;
  login_masked: string;
  account_currency: string;
  account_type: string;
  timezone: string;
  is_demo: number;
  is_archived: number;
  created_at: number;
  updated_at: number;
}

const AccountRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  broker: z.string(),
  server: z.string(),
  login_masked: z.string(),
  account_currency: z.string(),
  account_type: z.string(),
  timezone: z.string(),
  is_demo: z.union([z.literal(0), z.literal(1)]),
  is_archived: z.union([z.literal(0), z.literal(1)]),
  created_at: z.number(),
  updated_at: z.number(),
});

type AccountDatabase = Pick<Database, "execute" | "select">;
type DatabaseProvider = () => Promise<AccountDatabase>;

function toAccount(row: AccountRow): Account {
  const valid = AccountRowSchema.parse(row);
  return {
    id: valid.id,
    name: valid.name,
    broker: valid.broker,
    server: valid.server,
    loginMasked: valid.login_masked,
    accountCurrency: valid.account_currency,
    accountType: valid.account_type,
    timezone: valid.timezone,
    isDemo: valid.is_demo === 1,
    isArchived: valid.is_archived === 1,
    createdAt: valid.created_at,
    updatedAt: valid.updated_at,
  };
}

export class SqlAccountRepository implements AccountRepository {
  constructor(
    private readonly getDb: DatabaseProvider = getDatabaseConnection,
  ) {}

  async list(filter: AccountArchiveFilter): Promise<Account[]> {
    return this.guard("list accounts", async () => {
      const db = await this.getDb();
      const rows = await db.select<AccountRow[]>(
        `SELECT id, name, broker, server, login_masked, account_currency,
                account_type, timezone, is_demo, is_archived, created_at, updated_at
           FROM accounts
          WHERE is_archived = $1
          ORDER BY name COLLATE NOCASE ASC, created_at ASC`,
        [filter === "archived" ? 1 : 0],
      );
      return rows.map(toAccount);
    });
  }

  async findById(id: string): Promise<Account | null> {
    return this.guard("find account", async () => {
      const db = await this.getDb();
      const rows = await db.select<AccountRow[]>(
        `SELECT id, name, broker, server, login_masked, account_currency,
                account_type, timezone, is_demo, is_archived, created_at, updated_at
           FROM accounts WHERE id = $1 LIMIT 1`,
        [id],
      );
      return rows[0] ? toAccount(rows[0]) : null;
    });
  }

  async findDuplicate(
    broker: string,
    server: string,
    loginMasked: string,
    excludingId?: string,
  ): Promise<Account | null> {
    return this.guard("check duplicate account", async () => {
      const db = await this.getDb();
      const rows = await db.select<AccountRow[]>(
        `SELECT id, name, broker, server, login_masked, account_currency,
                account_type, timezone, is_demo, is_archived, created_at, updated_at
           FROM accounts
          WHERE lower(trim(broker)) = lower(trim($1))
            AND lower(trim(server)) = lower(trim($2))
            AND lower(trim(login_masked)) = lower(trim($3))
            AND ($4 IS NULL OR id <> $4)
          LIMIT 1`,
        [broker, server, loginMasked, excludingId ?? null],
      );
      return rows[0] ? toAccount(rows[0]) : null;
    });
  }

  async create(
    id: string,
    input: CreateAccountInput,
    timestamp: number,
  ): Promise<Account> {
    return this.guard("create account", async () => {
      const db = await this.getDb();
      await db.execute(
        `INSERT INTO accounts (
          id, name, broker, server, login_masked, account_currency,
          account_type, timezone, is_demo, is_archived, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $10)`,
        [
          id,
          input.name,
          input.broker,
          input.server,
          input.loginMasked,
          input.accountCurrency,
          input.accountType,
          input.timezone,
          input.isDemo ? 1 : 0,
          timestamp,
        ],
      );
      return {
        id,
        ...input,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  }

  async update(input: UpdateAccountInput, timestamp: number): Promise<Account> {
    return this.guard("update account", async () => {
      const db = await this.getDb();
      const result = await db.execute(
        `UPDATE accounts
            SET name = $2, broker = $3, server = $4, login_masked = $5,
                account_currency = $6, account_type = $7, timezone = $8,
                is_demo = $9, updated_at = $10
          WHERE id = $1`,
        [
          input.id,
          input.name,
          input.broker,
          input.server,
          input.loginMasked,
          input.accountCurrency,
          input.accountType,
          input.timezone,
          input.isDemo ? 1 : 0,
          timestamp,
        ],
      );
      if (result.rowsAffected === 0) {
        throw new Error("Account was not found");
      }
      const account = await this.findById(input.id);
      if (!account) {
        throw new Error("Updated account could not be loaded");
      }
      return account;
    });
  }

  async setArchived(
    id: string,
    isArchived: boolean,
    timestamp: number,
  ): Promise<Account> {
    return this.guard("change account archive state", async () => {
      const db = await this.getDb();
      const result = await db.execute(
        "UPDATE accounts SET is_archived = $2, updated_at = $3 WHERE id = $1",
        [id, isArchived ? 1 : 0, timestamp],
      );
      if (result.rowsAffected === 0) {
        throw new Error("Account was not found");
      }
      const account = await this.findById(id);
      if (!account) {
        throw new Error("Updated account could not be loaded");
      }
      return account;
    });
  }

  private async guard<T>(
    operation: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to ${operation}`, error);
    }
  }
}
