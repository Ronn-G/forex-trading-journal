import {
  CreateAccountInputSchema,
  UpdateAccountInputSchema,
  type Account,
  type CreateAccountInput,
  type UpdateAccountInput,
  type ValidationFieldError,
} from "../../domain/accounts/account";
import type {
  AccountArchiveFilter,
  AccountRepository,
} from "../../domain/accounts/AccountRepository";

export class AccountInputError extends Error {
  constructor(public readonly fieldErrors: ValidationFieldError[]) {
    super("Account details are invalid");
    this.name = "AccountInputError";
  }
}

export class DuplicateAccountError extends Error {
  constructor() {
    super("An account with the same broker, server, and masked login already exists");
    this.name = "DuplicateAccountError";
  }
}

export class AccountNotFoundError extends Error {
  constructor() {
    super("Account was not found");
    this.name = "AccountNotFoundError";
  }
}

function fieldErrors(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
}): ValidationFieldError[] {
  return error.issues.map((issue) => ({
    field: String(issue.path[0] ?? "form"),
    message: issue.message,
  }));
}

export class AccountService {
  constructor(
    private readonly repository: AccountRepository,
    private readonly now: () => number = Date.now,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  list(filter: AccountArchiveFilter = "active"): Promise<Account[]> {
    return this.repository.list(filter);
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const parsed = CreateAccountInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AccountInputError(fieldErrors(parsed.error));
    }

    const duplicate = await this.repository.findDuplicate(
      parsed.data.broker,
      parsed.data.server,
      parsed.data.loginMasked,
    );
    if (duplicate) {
      throw new DuplicateAccountError();
    }

    return this.repository.create(this.createId(), parsed.data, this.now());
  }

  async update(input: UpdateAccountInput): Promise<Account> {
    const parsed = UpdateAccountInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AccountInputError(fieldErrors(parsed.error));
    }

    const existing = await this.repository.findById(parsed.data.id);
    if (!existing) {
      throw new AccountNotFoundError();
    }

    const duplicate = await this.repository.findDuplicate(
      parsed.data.broker,
      parsed.data.server,
      parsed.data.loginMasked,
      parsed.data.id,
    );
    if (duplicate) {
      throw new DuplicateAccountError();
    }

    return this.repository.update(parsed.data, this.now());
  }

  async archive(id: string): Promise<Account> {
    return this.setArchived(id, true);
  }

  async unarchive(id: string): Promise<Account> {
    return this.setArchived(id, false);
  }

  private async setArchived(id: string, isArchived: boolean): Promise<Account> {
    if (!(await this.repository.findById(id))) {
      throw new AccountNotFoundError();
    }
    return this.repository.setArchived(id, isArchived, this.now());
  }
}
