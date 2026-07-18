import type {
  Account,
  CreateAccountInput,
  UpdateAccountInput,
} from "./account";

export type AccountArchiveFilter = "active" | "archived";

export interface AccountRepository {
  list(filter: AccountArchiveFilter): Promise<Account[]>;
  findById(id: string): Promise<Account | null>;
  findDuplicate(
    broker: string,
    server: string,
    loginMasked: string,
    excludingId?: string,
  ): Promise<Account | null>;
  create(
    id: string,
    input: CreateAccountInput,
    timestamp: number,
  ): Promise<Account>;
  update(input: UpdateAccountInput, timestamp: number): Promise<Account>;
  setArchived(
    id: string,
    isArchived: boolean,
    timestamp: number,
  ): Promise<Account>;
}
